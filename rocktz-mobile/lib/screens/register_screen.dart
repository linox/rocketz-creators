import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final fullName = TextEditingController();
  final artistic = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  final whatsapp = TextEditingController();
  final city = TextEditingController();
  final state = TextEditingController();
  final instagram = TextEditingController();
  bool lgpd = false;
  bool loading = false;
  String? error;

  @override
  void dispose() {
    fullName.dispose();
    artistic.dispose();
    email.dispose();
    password.dispose();
    whatsapp.dispose();
    city.dispose();
    state.dispose();
    instagram.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final session = context.read<AuthSession>();
    if (!lgpd) {
      setState(() => error = session.strings.t('lgpd'));
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await session.registerCreator({
        'full_name': fullName.text.trim(),
        'artistic_name': artistic.text.trim(),
        'email': email.text.trim(),
        'password': password.text,
        'password_confirmation': password.text,
        'whatsapp': whatsapp.text.trim(),
        'city': city.text.trim(),
        'state': state.text.trim().toUpperCase(),
        'instagram': instagram.text.trim(),
        'lgpd_accepted': true,
        'locale': session.locale,
      });
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
      appBar: AppBar(title: Text(t('signup'))),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(controller: fullName, decoration: InputDecoration(labelText: t('fullName'))),
          TextField(controller: artistic, decoration: InputDecoration(labelText: t('artisticName'))),
          TextField(controller: email, decoration: InputDecoration(labelText: t('email'))),
          TextField(controller: password, obscureText: true, decoration: InputDecoration(labelText: t('password'))),
          TextField(controller: whatsapp, decoration: InputDecoration(labelText: t('whatsapp'))),
          TextField(controller: city, decoration: InputDecoration(labelText: t('city'))),
          TextField(controller: state, decoration: InputDecoration(labelText: t('state'))),
          TextField(controller: instagram, decoration: InputDecoration(labelText: t('instagram'))),
          SwitchListTile(
            title: Text(t('lgpd')),
            value: lgpd,
            onChanged: (value) => setState(() => lgpd = value),
          ),
          if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
          FilledButton(onPressed: loading ? null : _submit, child: Text(t('signup'))),
        ],
      ),
    );
  }
}
