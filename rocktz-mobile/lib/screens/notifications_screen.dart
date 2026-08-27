import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';

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
      appBar: AppBar(
        title: Text(t('alerts')),
        actions: [TextButton(onPressed: _readAll, child: Text(t('markAll')))],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: items.isEmpty
            ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(error ?? t('empty')))])
            : ListView.builder(
                itemCount: items.length,
                itemBuilder: (context, index) {
                  final item = items[index] as Map<String, dynamic>;
                  final read = item['read'] == true;
                  return ListTile(
                    title: Text(item['title'] as String? ?? ''),
                    subtitle: Text(item['message'] as String? ?? ''),
                    leading: Icon(read ? Icons.mark_email_read : Icons.mark_email_unread),
                    onTap: () => _read(item['id'] as int),
                  );
                },
              ),
      ),
    );
  }
}
