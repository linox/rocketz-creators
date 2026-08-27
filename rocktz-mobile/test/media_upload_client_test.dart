import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rocktz_mobile/api/api_client.dart';
import 'package:rocktz_mobile/api/media_upload_client.dart';

void main() {
  test('uploads video in chunks to the API destination', () async {
    final temp = File('${Directory.systemTemp.path}/rocktz-upload-test.bin');
    await temp.writeAsBytes(List<int>.generate(12, (i) => i));

    var chunkPosts = 0;
    final mock = MockClient((request) async {
      if (request.method == 'POST' && request.url.path.endsWith('/media/uploads')) {
        return http.Response(
          jsonEncode({
            'data': {
              'id': 'up-1',
              'chunk_size': 5,
              'total_chunks': 3,
              'async': false,
              'destination': 'api',
              'part_urls': <String>[],
            },
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      }
      if (request.url.path.contains('/chunks/')) {
        chunkPosts += 1;
        return http.Response(jsonEncode({'data': {'index': 0}}), 200,
            headers: {'content-type': 'application/json'});
      }
      if (request.method == 'POST' && request.url.path.endsWith('/media/uploads/up-1')) {
        return http.Response(
          jsonEncode({
            'data': {'status': 'ready', 'progress': 100, 'url': 'https://media.test/v.mp4'},
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (request.method == 'GET' && request.url.path.endsWith('/media/uploads/up-1')) {
        return http.Response(
          jsonEncode({
            'data': {'status': 'ready', 'progress': 100, 'url': 'https://media.test/v.mp4'},
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response('not found ${request.url}', 404);
    });

    final api = ApiClient(
      baseUrl: 'http://api.test/api',
      httpClient: mock,
      tokenProvider: () async => 'token',
      localeProvider: () => 'pt-BR',
    );
    final client = MediaUploadClient(api, pollInterval: Duration.zero);
    final result = await client.uploadFile(temp);

    expect(chunkPosts, 3);
    expect(result.status, 'ready');
    expect(result.url, 'https://media.test/v.mp4');
    await temp.delete();
  });

  test('sends etags after presigned R2 part uploads', () async {
    final temp = File('${Directory.systemTemp.path}/rocktz-upload-r2.bin');
    await temp.writeAsBytes([1, 2, 3, 4]);

    var completeBody = '';
    final mock = MockClient((request) async {
      if (request.url.host == 'r2.test') {
        return http.Response('', 200, headers: {'etag': '"abc123"'});
      }
      if (request.url.path.endsWith('/media/uploads') && request.method == 'POST' && !request.url.path.contains('up-2')) {
        return http.Response(
          jsonEncode({
            'data': {
              'id': 'up-2',
              'chunk_size': 4,
              'total_chunks': 1,
              'async': true,
              'destination': 'r2',
              'part_urls': ['https://r2.test/part/0'],
            },
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      }
      if (request.method == 'POST' && request.url.path.endsWith('/media/uploads/up-2')) {
        completeBody = request.body;
        return http.Response(
          jsonEncode({'data': {'status': 'processing', 'progress': 90}}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      if (request.method == 'GET') {
        return http.Response(
          jsonEncode({'data': {'status': 'ready', 'progress': 100, 'url': 'https://cdn.test/v.mp4'}}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response('nope ${request.method} ${request.url}', 404);
    });

    final api = ApiClient(baseUrl: 'http://api.test/api', httpClient: mock);
    final result = await MediaUploadClient(api, pollInterval: Duration.zero).uploadFile(temp);
    expect(jsonDecode(completeBody)['parts'][0]['etag'], 'abc123');
    expect(result.status, 'ready');
    await temp.delete();
  });
}
