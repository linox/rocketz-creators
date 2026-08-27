import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';
import '../theme/app_colors.dart';
import '../widgets/app_ui.dart';
import '../widgets/home_charts.dart';
import 'contract_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.onOpenContract, this.onOpenTab});

  final VoidCallback? onOpenContract;
  final ValueChanged<int>? onOpenTab;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? stats;
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
      final session = context.read<AuthSession>();
      final json = Map<String, dynamic>.from(await session.api.getJson('/dashboard'));
      if (json['audience'] is! List) {
        final creatorId = session.user?.creator?.id;
        if (creatorId != null) {
          final profile = await session.api.getJson('/creators/$creatorId');
          final payload = profile['data'] is Map ? Map<String, dynamic>.from(profile['data'] as Map) : profile;
          json['audience'] = audienceFromMetrics(payload['metrics']);
        }
      }
      json['activity'] ??= const [];
      json['fees'] ??= const {'paid': 0, 'pending': 0};
      setState(() => stats = json);
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSession>();
    final t = session.strings.t;
    final creator = session.user?.creator;
    final name = creator?.artisticName ?? session.user?.name ?? '';

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: PinnedHeroBody(
        onRefresh: _load,
        hero: PageHero(
          title: '${t('hiThere')} $name!',
          subtitle: t('startHere'),
          trailing: creator == null ? null : StatusChip(label: creator.status, light: true),
        ),
        children: [
          if (creator != null && !creator.contractAccepted)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: SoftCard(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ContractScreen()),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        t('contract'),
                        style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 16),
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                  ],
                ),
              ),
            ),
          SoftCard(
            child: loading
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: Center(child: CircularProgressIndicator()),
                  )
                : error != null
                    ? Text(error!)
                    : Row(
                        children: [
                          _kpi(t('campaigns'), '${stats?['campaigns'] ?? 0}'),
                          _kpi(t('approved'), '${stats?['approved_campaigns'] ?? 0}'),
                          _kpi(t('pending'), '${stats?['pending_applications'] ?? 0}'),
                        ],
                      ),
          ),
          const SizedBox(height: 12),
          if (!loading && error == null) ...[
            _audienceCard(t),
            const SizedBox(height: 12),
            _activityCard(t),
            const SizedBox(height: 12),
            _feesCard(t),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              Expanded(
                child: SoftCard(
                  onTap: () => widget.onOpenTab?.call(1),
                  child: Text(
                    t('opportunities'),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.nunito(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SoftCard(
                  onTap: () => widget.onOpenTab?.call(2),
                  child: Text(
                    t('work'),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.nunito(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _maps(dynamic raw) {
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList();
  }

  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.ink),
    );
  }

  Widget _audienceCard(String Function(String) t) {
    final rows = _maps(stats?['audience']);
    final hasFollowers = rows.any((row) => ((row['followers'] as num?) ?? 0) > 0);
    final engagement = rows.where((row) => ((row['engagement'] as num?) ?? 0) > 0).toList();

    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(t('audienceTitle')),
          const SizedBox(height: 4),
          Text(
            t('followers'),
            style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.muted),
          ),
          const SizedBox(height: 16),
          if (!hasFollowers)
            Text(
              t('noAudience'),
              style: GoogleFonts.nunito(fontWeight: FontWeight.w600, color: AppColors.muted),
            )
          else
            SizedBox(height: 180, child: AudienceBarChart(rows: rows)),
          if (engagement.isNotEmpty) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final row in engagement)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.indigo.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      '${_networkLabel('${row['network']}')} ${compactNumber(row['engagement'] as num)}%',
                      style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.indigo),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _networkLabel(String network) {
    return switch (network) {
      'instagram' => 'Instagram',
      'tiktok' => 'TikTok',
      'youtube' => 'YouTube',
      'kwai' => 'Kwai',
      _ => network,
    };
  }

  Widget _activityCard(String Function(String) t) {
    final points = _maps(stats?['activity']);
    if (points.isEmpty) return const SizedBox.shrink();

    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(t('applicationsChart')),
          const SizedBox(height: 16),
          SizedBox(height: 168, child: ActivityLineChart(points: points)),
        ],
      ),
    );
  }

  Widget _feesCard(String Function(String) t) {
    final fees = stats?['fees'];
    if (fees is! Map) return const SizedBox.shrink();
    final paid = (fees['paid'] as num?) ?? 0;
    final pending = (fees['pending'] as num?) ?? 0;

    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(t('feesTitle')),
          const SizedBox(height: 12),
          Row(
            children: [
              _kpi(t('feesPaid'), formatBrl(paid)),
              _kpi(t('feesPending'), formatBrl(pending)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _kpi(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: GoogleFonts.nunito(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.ink),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}
