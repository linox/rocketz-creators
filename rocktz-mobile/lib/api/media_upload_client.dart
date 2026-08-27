import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'api_client.dart';
import 'api_exception.dart';

typedef UploadProgress = void Function(int percent);

class MediaPart {
  const MediaPart({required this.index, required this.etag});

  final int index;
  final String etag;

  Map<String, dynamic> toJson() => {'index': index, 'etag': etag};
}

class MediaUploadSession {
  MediaUploadSession({
    required this.id,
    required this.chunkSize,
    required this.totalChunks,
    required this.async,
    required this.destination,
    required this.partUrls,
  });

  factory MediaUploadSession.fromJson(Map<String, dynamic> json) {
    final urls = json['part_urls'];
    return MediaUploadSession(
      id: json['id'] as String,
      chunkSize: json['chunk_size'] as int,
      totalChunks: json['total_chunks'] as int,
      async: json['async'] == true,
      destination: json['destination'] as String? ?? 'api',
      partUrls: urls is List ? urls.map((e) => e.toString()).toList() : const [],
    );
  }

  final String id;
  final int chunkSize;
  final int totalChunks;
  final bool async;
  final String destination;
  final List<String> partUrls;
}

class MediaUploadState {
  MediaUploadState({
    required this.status,
    this.progress,
    this.message,
    this.url,
    this.path,
  });

  factory MediaUploadState.fromJson(Map<String, dynamic> json) {
    return MediaUploadState(
      status: json['status'] as String? ?? 'uploading',
      progress: json['progress'] is int ? json['progress'] as int : null,
      message: json['message'] as String?,
      url: json['url'] as String?,
      path: json['path'] as String?,
    );
  }

  final String status;
  final int? progress;
  final String? message;
  final String? url;
  final String? path;
}

class SubmissionUpload {
  const SubmissionUpload({
    required this.type,
    required this.id,
    this.payload = const {},
  });

  final String type;
  final int id;
  final Map<String, dynamic> payload;

  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'payload': payload,
      };
}

class MediaUploadClient {
  MediaUploadClient(this.api, {this.pollInterval = const Duration(seconds: 2)});

  final ApiClient api;
  final Duration pollInterval;

  static const maxVideoBytes = 1024 * 1024 * 1024;
  static const chunkRetries = 5;
  static const chunkConcurrency = 2;

  Future<MediaUploadState> uploadFile(
    File file, {
    SubmissionUpload? submission,
    UploadProgress? onProgress,
  }) async {
    final size = await file.length();
    if (size < 1 || size > maxVideoBytes) {
      throw ApiException('Invalid file size', status: 422);
    }

    final filename = file.uri.pathSegments.isEmpty ? 'video.mp4' : file.uri.pathSegments.last;
    final session = await initUpload(
      filename: filename,
      size: size,
      mimeType: _guessMime(filename),
      submission: submission,
    );

    final parts = await uploadChunks(file, session, onProgress: onProgress);
    final started = await completeUpload(session.id, parts: parts);
    return waitForUpload(session.id, started, onProgress: onProgress);
  }

  Future<MediaUploadSession> initUpload({
    required String filename,
    required int size,
    String mimeType = '',
    SubmissionUpload? submission,
  }) async {
    final json = await api.postJson('/media/uploads', {
      'filename': filename,
      'size': size,
      'mime_type': mimeType,
      if (submission != null) 'submission': submission.toJson(),
    });
    return MediaUploadSession.fromJson(json['data'] as Map<String, dynamic>);
  }

  Future<List<MediaPart>?> uploadChunks(
    File file,
    MediaUploadSession session, {
    UploadProgress? onProgress,
  }) async {
    final size = await file.length();
    final uploaded = List<int>.filled(session.totalChunks, 0);
    final etags = List<String>.filled(session.totalChunks, '');
    final pending = List<int>.generate(session.totalChunks, (i) => i);

    void report() {
      if (onProgress == null) {
        return;
      }
      final loaded = uploaded.fold<int>(0, (sum, value) => sum + value);
      onProgress(min(90, ((loaded / size) * 90).round()));
    }

    Future<void> sendChunk(int index) async {
      final start = index * session.chunkSize;
      final end = min(start + session.chunkSize, size);
      final chunk = await _readChunk(file, start, end);
      var attempt = 0;
      while (true) {
        try {
          final directUrl = index < session.partUrls.length ? session.partUrls[index] : null;
          if (directUrl != null && directUrl.isNotEmpty) {
            final response = await api.putBytes(directUrl, chunk);
            if (response.statusCode < 200 || response.statusCode >= 300) {
              throw ApiException('Chunk upload failed', status: response.statusCode);
            }
            etags[index] = (response.headers['etag'] ?? response.headers['ETag'] ?? '').replaceAll('"', '');
          } else {
            await api.send(
              'POST',
              '/media/uploads/${session.id}/chunks/$index',
              rawBody: chunk,
              contentType: 'application/octet-stream',
            );
          }
          uploaded[index] = chunk.length;
          report();
          return;
        } catch (_) {
          attempt += 1;
          if (attempt >= chunkRetries) {
            rethrow;
          }
          await Future<void>.delayed(Duration(milliseconds: 400 * attempt));
        }
      }
    }

    final workers = List.generate(min(chunkConcurrency, session.totalChunks), (_) async {
      while (pending.isNotEmpty) {
        final index = pending.removeAt(0);
        await sendChunk(index);
      }
    });
    await Future.wait(workers);

    if (session.partUrls.isEmpty) {
      return null;
    }
    return [
      for (var i = 0; i < session.totalChunks; i++) MediaPart(index: i, etag: etags[i]),
    ];
  }

  Future<MediaUploadState> completeUpload(String uploadId, {List<MediaPart>? parts}) async {
    final json = await api.postJson('/media/uploads/$uploadId', {
      if (parts != null) 'parts': parts.map((part) => part.toJson()).toList(),
    });
    final data = json['data'];
    if (data is Map<String, dynamic>) {
      return MediaUploadState.fromJson(data);
    }
    return MediaUploadState(status: 'processing', url: json['url'] as String?);
  }

  Future<MediaUploadState> status(String uploadId) async {
    final json = await api.getJson('/media/uploads/$uploadId');
    return MediaUploadState.fromJson(json['data'] as Map<String, dynamic>);
  }

  Future<void> cancel(String uploadId) {
    return api.deleteJson('/media/uploads/$uploadId');
  }

  Future<MediaUploadState> waitForUpload(
    String uploadId,
    MediaUploadState started, {
    UploadProgress? onProgress,
    Duration timeout = const Duration(minutes: 10),
  }) async {
    var current = started;
    final began = DateTime.now();
    while (current.status == 'uploading' || current.status == 'processing') {
      if (DateTime.now().difference(began) > timeout) {
        throw ApiException('Upload timeout', status: 408);
      }
      if (current.progress != null) {
        onProgress?.call(current.progress!);
      }
      await Future<void>.delayed(pollInterval);
      current = await status(uploadId);
    }
    if (current.status == 'failed') {
      throw ApiException(current.message ?? 'Upload failed', status: 422);
    }
    onProgress?.call(100);
    return current;
  }

  Future<Uint8List> _readChunk(File file, int start, int end) async {
    final raf = await file.open();
    try {
      await raf.setPosition(start);
      return await raf.read(end - start);
    } finally {
      await raf.close();
    }
  }

  String _guessMime(String filename) {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.mov')) {
      return 'video/quicktime';
    }
    if (lower.endsWith('.webm')) {
      return 'video/webm';
    }
    if (lower.endsWith('.png')) {
      return 'image/png';
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    return 'video/mp4';
  }
}
