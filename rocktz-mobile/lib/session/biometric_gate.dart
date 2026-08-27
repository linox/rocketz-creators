import 'package:local_auth/local_auth.dart';

abstract class BiometricGate {
  Future<bool> get isAvailable;
  Future<String> get label;
  Future<bool> authenticate(String reason);
}

class UnavailableBiometricGate implements BiometricGate {
  const UnavailableBiometricGate();

  @override
  Future<bool> get isAvailable async => false;

  @override
  Future<String> get label async => 'biometria';

  @override
  Future<bool> authenticate(String reason) async => false;
}

class LocalBiometricGate implements BiometricGate {
  LocalBiometricGate([LocalAuthentication? auth]) : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  @override
  Future<bool> get isAvailable async {
    try {
      final supported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      return supported && canCheck;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<String> get label async {
    try {
      final types = await _auth.getAvailableBiometrics();
      if (types.contains(BiometricType.face)) {
        return 'Face ID';
      }
      if (types.contains(BiometricType.fingerprint) || types.contains(BiometricType.strong)) {
        return 'Touch ID';
      }
    } catch (_) {}
    return 'biometria';
  }

  @override
  Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }
}
