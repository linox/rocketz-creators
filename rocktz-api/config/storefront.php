<?php

return [
    'min_completed_campaigns' => max(1, (int) env('STOREFRONT_MIN_COMPLETED_CAMPAIGNS', 3)),
];
