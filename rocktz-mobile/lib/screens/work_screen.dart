import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';
import 'campaign_detail_screen.dart';
import 'recurring_detail_screen.dart';

class WorkScreen extends StatefulWidget {
  const WorkScreen({super.key});

  @override
  State<WorkScreen> createState() => _WorkScreenState();
}

class _WorkScreenState extends State<WorkScreen> with SingleTickerProviderStateMixin {
  late final TabController tabs;
  List<dynamic> campaigns = [];
  List<dynamic> recurring = [];
  String? error;

  @override
  void initState() {
    super.initState();
    tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    tabs.dispose();
    super.dispose();
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
    return Scaffold(
      appBar: AppBar(
        title: Text(t('work')),
        bottom: TabBar(controller: tabs, tabs: [
          Tab(text: t('campaigns')),
          Tab(text: t('recurring')),
        ]),
      ),
      body: TabBarView(
        controller: tabs,
        children: [
          RefreshIndicator(
            onRefresh: _load,
            child: _list(campaigns, (item) => item['name'] as String? ?? '', (item) {
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => CampaignDetailScreen(campaignId: item['id'] as int),
              ));
            }),
          ),
          RefreshIndicator(
            onRefresh: _load,
            child: _list(recurring, (item) => item['title'] as String? ?? '', (item) {
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => RecurringDetailScreen(contractId: item['id'] as int),
              ));
            }),
          ),
        ],
      ),
    );
  }

  Widget _list(List<dynamic> items, String Function(Map<String, dynamic>) title, void Function(Map<String, dynamic>) onTap) {
    final t = context.read<AuthSession>().strings.t;
    if (error != null && items.isEmpty) {
      return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(error!))]);
    }
    if (items.isEmpty) {
      return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(t('empty')))]);
    }
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index] as Map<String, dynamic>;
        return ListTile(
          title: Text(title(item)),
          subtitle: Text(item['status'] as String? ?? ''),
          onTap: () => onTap(item),
        );
      },
    );
  }
}
