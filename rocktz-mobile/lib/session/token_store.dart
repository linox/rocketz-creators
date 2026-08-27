abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
  Future<bool> readBiometricEnabled();
  Future<void> writeBiometricEnabled(bool value);
}

class MemoryTokenStore implements TokenStore {
  String? _token;
  bool _biometric = false;

  @override
  Future<String?> read() async => _token;

  @override
  Future<void> write(String token) async => _token = token;

  @override
  Future<void> clear() async {
    _token = null;
    _biometric = false;
  }

  @override
  Future<bool> readBiometricEnabled() async => _biometric;

  @override
  Future<void> writeBiometricEnabled(bool value) async => _biometric = value;
}
