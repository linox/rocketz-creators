class AuthUser {
  AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.locale,
    this.creator,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final creator = json['creator'];
    return AuthUser(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      role: json['role'] as String? ?? '',
      locale: json['locale'] as String? ?? 'pt-BR',
      creator: creator is Map<String, dynamic> ? CreatorSummary.fromJson(creator) : null,
    );
  }

  final int id;
  final String name;
  final String email;
  final String role;
  final String locale;
  final CreatorSummary? creator;

  bool get isCreator => role == 'creator' && creator != null;
}

class CreatorSummary {
  CreatorSummary({
    required this.id,
    required this.artisticName,
    required this.status,
    this.fullName,
    this.photoUrl,
    this.contractAccepted = false,
  });

  factory CreatorSummary.fromJson(Map<String, dynamic> json) {
    final contract = json['contract_acceptance'];
    return CreatorSummary(
      id: json['id'] as int,
      artisticName: json['artistic_name'] as String? ?? '',
      status: json['status'] as String? ?? '',
      fullName: json['full_name'] as String?,
      photoUrl: json['photo_url'] as String?,
      contractAccepted: contract is Map && contract['id'] != null,
    );
  }

  final int id;
  final String artisticName;
  final String status;
  final String? fullName;
  final String? photoUrl;
  final bool contractAccepted;
}
