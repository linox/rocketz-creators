import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';
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
      appBar: AppBar(title: Text(t('opportunities'))),
      body: RefreshIndicator(
        onRefresh: _load,
        child: loading
            ? ListView(children: const [SizedBox(height: 120, child: Center(child: CircularProgressIndicator()))])
            : items.isEmpty
                ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(error ?? t('empty')))])
                : ListView.builder(
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final item = items[index] as Map<String, dynamic>;
                      return ListTile(
                        title: Text(item['name'] as String? ?? ''),
                        subtitle: Text(item['company'] is Map ? (item['company']['name'] as String? ?? '') : ''),
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => CampaignDetailScreen(campaignId: item['id'] as int, marketplace: true),
                        )),
                      );
                    },
                  ),
      ),
    );
  }
}
