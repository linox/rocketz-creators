import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';

class TwoFactorScreen extends StatefulWidget {
  const TwoFactorScreen({super.key, required this.challengeToken});

  final String challengeToken;

  @override
  State<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends State<TwoFactorScreen> {
  final code = TextEditingController();
  bool loading = false;
  String? error;

  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await context.read<AuthSession>().verifyTwoFactor(widget.challengeToken, code.text.trim());
      if (mounted) Navigator.of(context).pop();
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
    return Scaffold(
      appBar: AppBar(title: Text(t('code'))),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            TextField(
              controller: code,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: t('code')),
            ),
            if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 16),
            FilledButton(onPressed: loading ? null : _verify, child: Text(t('verify'))),
            TextButton(
              onPressed: () => session.resendTwoFactor(widget.challengeToken),
              child: Text(t('resend')),
            ),
          ],
        ),
      ),
    );
  }
}
