import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_exception.dart';

class ApiClient {
  ApiClient({
    required this.baseUrl,
    http.Client? httpClient,
    this.tokenProvider,
    this.localeProvider,
  }) : httpClient = httpClient ?? http.Client();

  final String baseUrl;
  final http.Client httpClient;
  final Future<String?> Function()? tokenProvider;
  final String Function()? localeProvider;

  Future<Map<String, dynamic>> getJson(String path, {Map<String, String>? query}) {
    return send('GET', path, query: query);
  }

  Future<Map<String, dynamic>> postJson(String path, [Map<String, dynamic>? body]) {
    return send('POST', path, body: body);
  }

  Future<Map<String, dynamic>> patchJson(String path, Map<String, dynamic> body) {
    return send('PATCH', path, body: body);
  }

  Future<Map<String, dynamic>> deleteJson(String path, [Map<String, dynamic>? body]) {
    return send('DELETE', path, body: body);
  }

  Future<Map<String, dynamic>> send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    Map<String, String>? extraHeaders,
    List<int>? rawBody,
    String? contentType,
  }) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final headers = await _headers(contentType: contentType ?? (rawBody == null ? 'application/json' : null));
    if (extraHeaders != null) {
      headers.addAll(extraHeaders);
    }

    late http.Response response;
    final encoded = rawBody ?? (body == null ? null : utf8.encode(jsonEncode(body)));
    switch (method) {
      case 'GET':
        response = await httpClient.get(uri, headers: headers);
      case 'POST':
        response = await httpClient.post(uri, headers: headers, body: encoded);
      case 'PATCH':
        response = await httpClient.patch(uri, headers: headers, body: encoded);
      case 'DELETE':
        response = await httpClient.delete(uri, headers: headers, body: encoded);
      case 'PUT':
        response = await httpClient.put(uri, headers: headers, body: encoded);
      default:
        throw ApiException('Unsupported method $method');
    }

    return decodeResponse(response);
  }

  Future<http.Response> putBytes(
    String url,
    List<int> bytes, {
    Map<String, String>? extraHeaders,
  }) {
    return httpClient.put(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/octet-stream',
        ...?extraHeaders,
      },
      body: bytes,
    );
  }

  static Map<String, dynamic> decodeResponse(http.Response response) {
    Map<String, dynamic> json = {};
    if (response.body.isNotEmpty) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        json = decoded;
      } else if (decoded is List) {
        json = {'data': decoded};
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final errors = <String, List<String>>{};
      final rawErrors = json['errors'];
      if (rawErrors is Map) {
        rawErrors.forEach((key, value) {
          if (value is List) {
            errors[key.toString()] = value.map((e) => e.toString()).toList();
          }
        });
      }
      throw ApiException(
        (json['message'] as String?) ?? 'Request failed',
        status: response.statusCode,
        errors: errors.isEmpty ? null : errors,
      );
    }

    return json;
  }

  Future<Map<String, String>> _headers({String? contentType}) async {
    final locale = localeProvider?.call() ?? 'pt-BR';
    final headers = <String, String>{
      'Accept': 'application/json',
      'Accept-Language': locale,
    };
    if (contentType != null) {
      headers['Content-Type'] = contentType;
    }
    final token = await tokenProvider?.call();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
      headers['X-Auth-Token'] = token;
    }
    return headers;
  }
}
