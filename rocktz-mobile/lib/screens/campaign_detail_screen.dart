import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../api/media_upload_client.dart';
import '../session/auth_session.dart';
import '../theme/app_colors.dart';
import '../widgets/app_ui.dart';

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
      backgroundColor: AppColors.canvas,
      body: PinnedHeroBody(
        hero: PageHero(
          showBack: true,
          title: campaign?['name'] as String? ?? t('campaigns'),
        ),
        children: [
          if (loading)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            if (error != null) Text(error!, style: const TextStyle(color: Color(0xFFB91C1C))),
            if (briefing is Map)
              SoftCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('briefing'), style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 16)),
                    const SizedBox(height: 8),
                    Text(
                      briefing['key_message'] as String? ?? briefing['product'] as String? ?? '',
                      style: GoogleFonts.nunito(color: AppColors.muted, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            SoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.marketplace && _own == null) ...[
                    TextField(controller: notes, decoration: softField(t('notes'))),
                    const SizedBox(height: 16),
                    DarkPillButton(label: t('apply'), onPressed: busy ? null : _apply, busy: busy),
                  ],
                  if (_own != null) ...[
                    StatusChip(
                      label: '${_own!['application_status'] ?? ''} · ${_own!['payment_status'] ?? ''}',
                    ),
                    const SizedBox(height: 16),
                    TextField(controller: script, maxLines: 4, decoration: softField(t('script'))),
                    const SizedBox(height: 12),
                    DarkPillButton(
                      label: t('submitScript'),
                      busy: busy,
                      onPressed: () => _patch({'script': script.text, 'script_status': 'submitted'}),
                    ),
                    if (busy && uploadPercent > 0) ...[
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(value: uploadPercent / 100, minHeight: 8),
                      ),
                    ],
                    const SizedBox(height: 12),
                    DarkPillButton(label: t('submitVideo'), busy: busy, onPressed: _pickVideo),
                    const SizedBox(height: 12),
                    TextField(controller: published, decoration: softField(t('publishedLink'))),
                    const SizedBox(height: 12),
                    DarkPillButton(
                      label: t('submitLink'),
                      busy: busy,
                      onPressed: () => _patch({
                        'published_link': published.text.trim(),
                        'delivery_status': 'published',
                      }),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
