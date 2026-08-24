<?php

namespace Database\Seeders;

final class DemoAccounts
{
    public const PASSWORD = 'password';

    public const ADMIN = 'admin@rocketz.test';

    public const CREATOR_ANA = 'ana.creator@rocketz.test';

    public const CREATOR_BRUNO = 'bruno.creator@rocketz.test';

    public const CREATOR_CAMILA = 'camila.creator@rocketz.test';

    public const CREATOR_DIEGO = 'diego.creator@rocketz.test';

    public const COMPANY_AURORA = 'empresa@rocketz.test';

    public const COMPANY_LUMEN = 'pending.empresa@rocketz.test';

    /**
     * @return list<array{role: string, email: string}>
     */
    public static function loginTable(): array
    {
        return [
            ['role' => 'admin', 'email' => self::ADMIN],
            ['role' => 'criador active', 'email' => self::CREATOR_ANA],
            ['role' => 'criador review', 'email' => self::CREATOR_BRUNO],
            ['role' => 'criador paused', 'email' => self::CREATOR_CAMILA],
            ['role' => 'criador rejected', 'email' => self::CREATOR_DIEGO],
            ['role' => 'empresa active', 'email' => self::COMPANY_AURORA],
            ['role' => 'empresa pending', 'email' => self::COMPANY_LUMEN],
        ];
    }
}
