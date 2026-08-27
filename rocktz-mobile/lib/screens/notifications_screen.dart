import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';
import '../theme/app_colors.dart';
import '../widgets/app_ui.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, this.onChanged});

  final VoidCallback? onChanged;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> items = [];
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await context.read<AuthSession>().api.getJson('/notifications');
      setState(() => items = json['data'] as List? ?? []);
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  Future<void> _read(int id) async {
    await context.read<AuthSession>().api.patchJson('/notifications/$id/read', {});
    await _load();
    widget.onChanged?.call();
  }

  Future<void> _readAll() async {
    await context.read<AuthSession>().api.postJson('/notifications/read-all');
    await _load();
    widget.onChanged?.call();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AuthSession>().strings.t;
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: PinnedHeroBody(
        onRefresh: _load,
        hero: PageHero(
          title: t('alerts'),
          trailing: TextButton(
            onPressed: _readAll,
            child: Text(t('markAll'), style: GoogleFonts.nunito(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ),
        children: [
          if (items.isEmpty)
            EmptyHint(error ?? t('empty'))
          else
            for (final raw in items)
              if (raw is Map<String, dynamic>)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: SoftCard(
                    color: raw['read'] == true ? Colors.white : const Color(0xFFF5F3FF),
                    onTap: () => _read(raw['id'] as int),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          raw['title'] as String? ?? '',
                          style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 16),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          raw['message'] as String? ?? '',
                          style: GoogleFonts.nunito(color: AppColors.muted, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
        ],
      ),
    );
  }
}
