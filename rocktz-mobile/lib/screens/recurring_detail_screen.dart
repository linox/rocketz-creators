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

class RecurringDetailScreen extends StatefulWidget {
  const RecurringDetailScreen({super.key, required this.contractId});

  final int contractId;

  @override
  State<RecurringDetailScreen> createState() => _RecurringDetailScreenState();
}

class _RecurringDetailScreenState extends State<RecurringDetailScreen> {
  Map<String, dynamic>? contract;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await context.read<AuthSession>().api.getJson(
        '/recurring-contracts/${widget.contractId}',
        query: {'include': 'items'},
      );
      setState(() => contract = json['data'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  Future<void> _submitItem(Map<String, dynamic> item) async {
    final picked = await ImagePicker().pickVideo(source: ImageSource.gallery);
    if (picked == null || !mounted) {
      return;
    }
    try {
      final session = context.read<AuthSession>();
      await MediaUploadClient(session.api).uploadFile(
        File(picked.path),
        submission: SubmissionUpload(
          type: 'content_planning_item',
          id: item['id'] as int,
          payload: {'video_status': 'submitted'},
        ),
      );
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AuthSession>().strings.t;
    final items = contract?['items'];
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: PinnedHeroBody(
        hero: PageHero(
          showBack: true,
          title: contract?['title'] as String? ?? t('recurring'),
        ),
        children: [
          if (error != null) Text(error!),
          if (items is List)
            for (final raw in items)
              if (raw is Map<String, dynamic>)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: SoftCard(
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                raw['title'] as String? ?? t('pauta'),
                                style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 16),
                              ),
                              const SizedBox(height: 6),
                              StatusChip(label: raw['status'] as String? ?? ''),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.upload_rounded),
                          onPressed: () => _submitItem(raw),
                        ),
                      ],
                    ),
                  ),
                ),
        ],
      ),
    );
  }
}
