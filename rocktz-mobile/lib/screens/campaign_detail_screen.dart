import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../api/media_upload_client.dart';
import '../session/auth_session.dart';

class CampaignDetailScreen extends StatefulWidget {
  const CampaignDetailScreen({super.key, required this.campaignId, this.marketplace = false});

  final int campaignId;
  final bool marketplace;

  @override
  State<CampaignDetailScreen> createState() => _CampaignDetailScreenState();
}

class _CampaignDetailScreenState extends State<CampaignDetailScreen> {
  Map<String, dynamic>? campaign;
  String? error;
  bool loading = true;
  bool busy = false;
  int uploadPercent = 0;
  final script = TextEditingController();
  final published = TextEditingController();
  final notes = TextEditingController();

  @override
  void dispose() {
    script.dispose();
    published.dispose();
    notes.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Map<String, dynamic>? get _own {
    final apps = campaign?['applications'];
    if (apps is! List || apps.isEmpty) {
      return null;
    }
    return apps.first as Map<String, dynamic>;
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final json = await context.read<AuthSession>().api.getJson(
        '/campaigns/${widget.campaignId}',
        query: {'include': 'content'},
      );
      final data = json['data'] as Map<String, dynamic>;
      campaign = data;
      final content = _own?['content'];
      if (content is Map) {
        script.text = content['script'] as String? ?? '';
        published.text = content['published_link'] as String? ?? '';
      }
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _apply() async {
    setState(() => busy = true);
    try {
      await context.read<AuthSession>().api.postJson('/campaigns/${widget.campaignId}/apply', {
        'notes': notes.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.read<AuthSession>().strings.t('applied'))),
        );
      }
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _patch(Map<String, dynamic> payload) async {
    final id = _own?['id'];
    if (id is! int) {
      return;
    }
    setState(() => busy = true);
    try {
      await context.read<AuthSession>().api.patchJson('/campaign-creators/$id', payload);
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _pickVideo() async {
    final picked = await ImagePicker().pickVideo(source: ImageSource.gallery);
    if (picked == null || !mounted) {
      return;
    }
    final ownId = _own?['id'];
    if (ownId is! int) {
      return;
    }
    setState(() {
      busy = true;
      uploadPercent = 0;
    });
    try {
      final session = context.read<AuthSession>();
      final uploader = MediaUploadClient(session.api);
      await uploader.uploadFile(
        File(picked.path),
        submission: SubmissionUpload(
          type: 'campaign_creator',
          id: ownId,
          payload: {'video_status': 'submitted', 'delivery_status': 'sent'},
        ),
        onProgress: (percent) => setState(() => uploadPercent = percent),
      );
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AuthSession>().strings.t;
    final briefing = campaign?['briefing'];
    return Scaffold(
      appBar: AppBar(title: Text(campaign?['name'] as String? ?? t('campaigns'))),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
                if (briefing is Map) ...[
                  Text(t('briefing'), style: Theme.of(context).textTheme.titleMedium),
                  Text(briefing['key_message'] as String? ?? briefing['product'] as String? ?? ''),
                ],
                if (widget.marketplace && _own == null) ...[
                  TextField(controller: notes, decoration: InputDecoration(labelText: t('notes'))),
                  FilledButton(onPressed: busy ? null : _apply, child: Text(t('apply'))),
                ],
                if (_own != null) ...[
                  Text('${t('status')}: ${_own!['application_status'] ?? ''} · ${_own!['payment_status'] ?? ''}'),
                  TextField(controller: script, maxLines: 4, decoration: InputDecoration(labelText: t('script'))),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () => _patch({'script': script.text, 'script_status': 'submitted'}),
                    child: Text(t('submitScript')),
                  ),
                  if (busy && uploadPercent > 0) LinearProgressIndicator(value: uploadPercent / 100),
                  FilledButton(onPressed: busy ? null : _pickVideo, child: Text(t('submitVideo'))),
                  TextField(controller: published, decoration: InputDecoration(labelText: t('publishedLink'))),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () => _patch({
                              'published_link': published.text.trim(),
                              'delivery_status': 'published',
                            }),
                    child: Text(t('submitLink')),
                  ),
                ],
              ],
            ),
    );
  }
}
