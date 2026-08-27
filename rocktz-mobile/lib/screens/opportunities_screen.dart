import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';
import '../theme/app_colors.dart';
import '../widgets/app_ui.dart';
import 'campaign_detail_screen.dart';

class OpportunitiesScreen extends StatefulWidget {
  const OpportunitiesScreen({super.key});

  @override
  State<OpportunitiesScreen> createState() => _OpportunitiesScreenState();
}

class _OpportunitiesScreenState extends State<OpportunitiesScreen> {
  List<dynamic> items = [];
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final json = await context.read<AuthSession>().api.getJson('/campaigns/available');
      setState(() => items = json['data'] as List? ?? []);
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AuthSession>().strings.t;
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: PinnedHeroBody(
        onRefresh: _load,
        hero: PageHero(title: t('opportunities')),
        children: [
          if (loading)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (items.isEmpty)
            EmptyHint(error ?? t('empty'))
          else
            for (final raw in items)
              if (raw is Map<String, dynamic>)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: SoftCard(
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => CampaignDetailScreen(campaignId: raw['id'] as int, marketplace: true),
                    )),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                raw['name'] as String? ?? '',
                                style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 17),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                raw['company'] is Map ? (raw['company']['name'] as String? ?? '') : '',
                                style: GoogleFonts.nunito(color: AppColors.muted, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                      ],
                    ),
                  ),
                ),
        ],
      ),
    );
  }
}
