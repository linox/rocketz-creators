<?php

namespace App\Enums;

enum ApprovalFlowType: string
{
    case ScriptAndVideo = 'script_and_video';
    case VideoOnly = 'video_only';
    case ScriptOnly = 'script_only';
    case LiveLink = 'live_link';
}
