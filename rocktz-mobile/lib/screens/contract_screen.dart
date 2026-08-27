import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';

class ContractScreen extends StatefulWidget {
  const ContractScreen({super.key});

  @override
  State<ContractScreen> createState() => _ContractScreenState();
}

class _ContractScreenState extends State<ContractScreen> {
  final name = TextEditingController();
  final document = TextEditingController();
  final email = TextEditingController();
  String? error;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthSession>().user;
    name.text = user?.creator?.fullName ?? user?.name ?? '';
    email.text = user?.email ?? '';
  }

  @override
  void dispose() {
    name.dispose();
    document.dispose();
    email.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    final session = context.read<AuthSession>();
    final id = session.user?.creator?.id;
    if (id == null) {
      return;
    }
    setState(() => loading = true);
    try {
      await session.api.postJson('/creators/$id/contract', {
        'full_name': name.text.trim(),
        'document': document.text.trim(),
        'email': email.text.trim(),
      });
      await session.refreshMe();
      if (mounted) Navigator.of(context).pop();
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
      appBar: AppBar(title: Text(t('contract'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: name, decoration: InputDecoration(labelText: t('fullName'))),
          TextField(controller: document, decoration: InputDecoration(labelText: t('state'))),
          TextField(controller: email, decoration: InputDecoration(labelText: t('email'))),
          if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
          FilledButton(onPressed: loading ? null : _accept, child: Text(t('acceptContract'))),
        ],
      ),
    );
  }
}
