import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../l10n/strings.dart';
import '../models/auth_user.dart';
import 'biometric_gate.dart';
import 'token_store.dart';

class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'rocktz_token';
  static const _bioKey = 'rocktz_biometric';

  @override
  Future<String?> read() => _storage.read(key: _key);

  @override
  Future<void> write(String token) => _storage.write(key: _key, value: token);

  @override
  Future<void> clear() async {
    await _storage.delete(key: _key);
    await _storage.delete(key: _bioKey);
  }

  @override
  Future<bool> readBiometricEnabled() async {
    return await _storage.read(key: _bioKey) == '1';
  }

  @override
  Future<void> writeBiometricEnabled(bool value) {
    if (value) {
      return _storage.write(key: _bioKey, value: '1');
    }
    return _storage.delete(key: _bioKey);
  }
}

class AuthSession extends ChangeNotifier {
  AuthSession({
    required ApiClient Function(AuthSession session) clientFactory,
    TokenStore? tokenStore,
    BiometricGate? biometrics,
    String locale = 'pt-BR',
  })  : store = tokenStore ?? SecureTokenStore(),
        biometrics = biometrics ?? LocalBiometricGate(),
        _locale = AppStrings.normalize(locale) {
    api = clientFactory(this);
  }

  final TokenStore store;
  final BiometricGate biometrics;
  late final ApiClient api;
  AuthUser? user;
  String? token;
  bool ready = false;
  bool locked = false;
  bool biometricEnabled = false;
  bool biometricAvailable = false;
  bool offerBiometric = false;
  String biometricLabel = 'biometria';
  String _locale;

  String get locale => _locale;
  AppStrings get strings => AppStrings(_locale);
  bool get isLoggedIn => token != null && user?.isCreator == true && !locked;
  bool get canUnlockWithBiometrics => locked && biometricEnabled && token != null;

  Future<void> bootstrap() async {
    token = await store.read();
    biometricEnabled = await store.readBiometricEnabled();
    biometricAvailable = await biometrics.isAvailable;
    biometricLabel = await biometrics.label;

    if (token != null && biometricEnabled) {
      locked = true;
      ready = true;
      notifyListeners();
      await unlockWithBiometrics();
      return;
    }

    if (token != null) {
      try {
        await refreshMe();
        if (user != null && !user!.isCreator) {
          await logout();
        }
      } catch (_) {
        await logout();
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<bool> unlockWithBiometrics() async {
    if (token == null) {
      return false;
    }
    final ok = await biometrics.authenticate(strings.t('biometricReason'));
    if (!ok) {
      return false;
    }
    try {
      await refreshMe();
      if (user != null && !user!.isCreator) {
        await logout();
        return false;
      }
      locked = false;
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> enableBiometrics() async {
    if (!biometricAvailable) {
      return false;
    }
    final ok = await biometrics.authenticate(strings.t('biometricReason'));
    if (!ok) {
      return false;
    }
    biometricEnabled = true;
    offerBiometric = false;
    await store.writeBiometricEnabled(true);
    notifyListeners();
    return true;
  }

  Future<void> disableBiometrics() async {
    biometricEnabled = false;
    offerBiometric = false;
    await store.writeBiometricEnabled(false);
    notifyListeners();
  }

  void dismissBiometricOffer() {
    offerBiometric = false;
    notifyListeners();
  }

  Future<AuthUser> login(String email, String password) async {
    final json = await api.postJson('/auth/login', {
      'email': email,
      'password': password,
    });
    if (json['two_factor_required'] == true) {
      throw TwoFactorRequired(json['challenge_token'] as String);
    }
    return _acceptAuth(json);
  }

  Future<AuthUser> verifyTwoFactor(String challengeToken, String code) async {
    final json = await api.postJson('/auth/two-factor/verify', {
      'challenge_token': challengeToken,
      'code': code,
    });
    return _acceptAuth(json);
  }

  Future<void> resendTwoFactor(String challengeToken) {
    return api.postJson('/auth/two-factor/resend', {
      'challenge_token': challengeToken,
    });
  }

  Future<AuthUser> registerCreator(Map<String, dynamic> payload) async {
    final json = await api.postJson('/auth/register/creator', payload);
    return _acceptAuth(json);
  }

  Future<void> forgotPassword(String email) {
    return api.postJson('/auth/forgot-password', {'email': email});
  }

  Future<void> refreshMe() async {
    final json = await api.getJson('/auth/me');
    final data = json['data'] ?? json['user'] ?? json;
    user = AuthUser.fromJson(data as Map<String, dynamic>);
    _locale = AppStrings.normalize(user?.locale);
    notifyListeners();
  }

  Future<void> setLocale(String locale) async {
    _locale = AppStrings.normalize(locale);
    notifyListeners();
    if (token != null && !locked) {
      await api.patchJson('/auth/locale', {'locale': _locale});
    }
  }

  Future<void> registerDeviceToken(String fcmToken, String platform) async {
    if (token == null || locked) {
      return;
    }
    await api.postJson('/device-tokens', {
      'token': fcmToken,
      'platform': platform,
    });
  }

  Future<void> unregisterDeviceToken(String fcmToken) async {
    if (token == null) {
      return;
    }
    try {
      await api.deleteJson('/device-tokens', {'token': fcmToken});
    } catch (_) {}
  }

  Future<void> logout() async {
    final current = token;
    try {
      if (current != null && !locked) {
        await api.postJson('/auth/logout');
      }
    } catch (_) {}
    token = null;
    user = null;
    locked = false;
    biometricEnabled = false;
    offerBiometric = false;
    await store.clear();
    notifyListeners();
  }

  Future<AuthUser> _acceptAuth(Map<String, dynamic> json) async {
    final issued = json['token'] as String?;
    final rawUser = json['user'] as Map<String, dynamic>?;
    if (issued == null || rawUser == null) {
      throw ApiException('Invalid auth response');
    }
    final parsed = AuthUser.fromJson(rawUser);
    if (!parsed.isCreator) {
      throw ApiException(strings.t('onlyCreators'), status: 403);
    }
    token = issued;
    user = parsed;
    locked = false;
    _locale = AppStrings.normalize(parsed.locale);
    await store.write(issued);
    biometricAvailable = await biometrics.isAvailable;
    biometricLabel = await biometrics.label;
    offerBiometric = biometricAvailable && !biometricEnabled;
    notifyListeners();
    return parsed;
  }

  Future<String?> tokenValue() async => token;
}

class TwoFactorRequired implements Exception {
  TwoFactorRequired(this.challengeToken);
  final String challengeToken;
}
