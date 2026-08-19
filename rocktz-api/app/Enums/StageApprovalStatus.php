<?php

namespace App\Enums;

enum StageApprovalStatus: string
{
    case Pending = 'pending';
    case Submitted = 'submitted';
    case Approved = 'approved';
    case Revision = 'revision';
}
