<?php

namespace App\Console\Commands;

use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoAccounts;
use Illuminate\Console\Command;

class SeedDemoCommand extends Command
{
    protected $signature = 'demo:seed {--force : Allow the command to run in production}';

    protected $description = 'Seed demo/test accounts and sample data without wiping the database';

    public function handle(): int
    {
        if ($this->laravel->environment('production') && ! $this->option('force')) {
            $this->error('Em produção use: php artisan demo:seed --force');
            $this->line('O comando não apaga dados existentes; só cria contas e amostras que ainda não existem.');

            return self::FAILURE;
        }

        $this->call('db:seed', [
            '--class' => DatabaseSeeder::class,
            '--force' => true,
        ]);

        $this->newLine();
        $this->info('Contas de teste (senha: '.DemoAccounts::PASSWORD.')');
        $this->table(
            ['Papel', 'E-mail'],
            array_map(fn (array $row) => [$row['role'], $row['email']], DemoAccounts::loginTable()),
        );
        $this->comment('Não usa migrate:fresh. Usuários reais já cadastrados permanecem.');

        return self::SUCCESS;
    }
}
