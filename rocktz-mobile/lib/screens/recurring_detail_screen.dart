import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../api/media_upload_client.dart';
import '../session/auth_session.dart';

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
      appBar: AppBar(title: Text(contract?['title'] as String? ?? t('recurring'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (error != null) Text(error!),
          if (items is List)
            for (final raw in items)
              if (raw is Map<String, dynamic>)
                Card(
                  child: ListTile(
                    title: Text(raw['title'] as String? ?? t('pauta')),
                    subtitle: Text(raw['status'] as String? ?? ''),
                    trailing: IconButton(
                      icon: const Icon(Icons.upload),
                      onPressed: () => _submitItem(raw),
                    ),
                  ),
                ),
        ],
      ),
    );
  }
}
