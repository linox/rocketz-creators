import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';
import '../theme/app_colors.dart';
import '../widgets/app_ui.dart';
import 'campaign_detail_screen.dart';
import 'recurring_detail_screen.dart';

class WorkScreen extends StatefulWidget {
  const WorkScreen({super.key});

  @override
  State<WorkScreen> createState() => _WorkScreenState();
}

class _WorkScreenState extends State<WorkScreen> {
  int tab = 0;
  List<dynamic> campaigns = [];
  List<dynamic> recurring = [];
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = context.read<AuthSession>().api;
      final c = await api.getJson('/campaigns', query: {'include': 'content'});
      final r = await api.getJson('/recurring-contracts');
      setState(() {
        campaigns = c['data'] as List? ?? [];
        recurring = r['data'] as List? ?? [];
        error = null;
      });
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AuthSession>().strings.t;
    final items = tab == 0 ? campaigns : recurring;
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: PinnedHeroBody(
        onRefresh: _load,
        hero: PageHero(title: t('work')),
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: SegmentPills(
              labels: [t('campaigns'), t('recurring')],
              index: tab,
              onChanged: (value) => setState(() => tab = value),
            ),
          ),
          if (error != null && items.isEmpty)
            EmptyHint(error!)
          else if (items.isEmpty)
            EmptyHint(t('empty'))
          else
            for (final raw in items)
              if (raw is Map<String, dynamic>)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: SoftCard(
                    onTap: () {
                      if (tab == 0) {
                        Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => CampaignDetailScreen(campaignId: raw['id'] as int),
                        ));
                      } else {
                        Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => RecurringDetailScreen(contractId: raw['id'] as int),
                        ));
                      }
                    },
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                tab == 0 ? (raw['name'] as String? ?? '') : (raw['title'] as String? ?? ''),
                                style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 17),
                              ),
                              const SizedBox(height: 6),
                              StatusChip(label: raw['status'] as String? ?? ''),
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
