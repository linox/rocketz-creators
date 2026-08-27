class ApiException implements Exception {
  ApiException(this.message, {this.status = 0, this.errors});

  final String message;
  final int status;
  final Map<String, List<String>>? errors;

  @override
  String toString() => message;
}
