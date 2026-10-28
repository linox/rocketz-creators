<?php

use App\Support\SensitiveIndex;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropUnique(['cnpj']);
        });

        $this->widen('creators', [
            'document' => 'text',
            'cpf' => 'text',
            'whatsapp' => 'text',
            'birth_date' => 'text',
            'shipping_address' => 'longText',
            'pix_key' => 'text',
            'bank_account' => 'longText',
            'bank_details' => 'longText',
        ]);
        $this->widen('companies', [
            'cnpj' => 'text',
            'whatsapp' => 'text',
            'email' => 'text',
        ]);
        $this->widen('company_contacts', [
            'email' => 'text',
            'whatsapp' => 'text',
        ]);
        $this->widen('campaigns', [
            'sender_phone' => 'text',
            'sender_address' => 'longText',
        ]);
        $this->widen('shipping_senders', [
            'phone' => 'text',
            'address' => 'longText',
        ]);
        $this->widen('creator_contract_acceptances', [
            'document' => 'text',
            'email' => 'text',
            'ip' => 'text',
        ]);
        $this->widen('activity_logs', [
            'ip' => 'text',
        ]);

        Schema::table('companies', function (Blueprint $table) {
            $table->char('cnpj_hash', 64)->nullable()->unique();
            $table->char('email_hash', 64)->nullable()->index();
        });
        Schema::table('company_contacts', function (Blueprint $table) {
            $table->char('email_hash', 64)->nullable()->index();
        });
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->char('ip_hash', 64)->nullable()->index();
        });

        $this->encryptTable('creators', ['document', 'cpf', 'whatsapp', 'shipping_address', 'pix_key', 'bank_account', 'bank_details']);
        $this->encryptDates('creators', 'birth_date');
        $this->encryptCompanies();
        $this->encryptContacts();
        $this->encryptTable('campaigns', ['sender_phone', 'sender_address']);
        $this->encryptTable('shipping_senders', ['phone', 'address']);
        $this->encryptTable('creator_contract_acceptances', ['document', 'email', 'ip']);
        $this->encryptActivityIps();
    }

    public function down(): void
    {
        $this->decryptTable('creators', ['document', 'cpf', 'whatsapp', 'birth_date', 'shipping_address', 'pix_key', 'bank_account', 'bank_details']);
        $this->decryptTable('companies', ['cnpj', 'whatsapp', 'email']);
        $this->decryptTable('company_contacts', ['email', 'whatsapp']);
        $this->decryptTable('campaigns', ['sender_phone', 'sender_address']);
        $this->decryptTable('shipping_senders', ['phone', 'address']);
        $this->decryptTable('creator_contract_acceptances', ['document', 'email', 'ip']);
        $this->decryptTable('activity_logs', ['ip']);

        Schema::table('companies', function (Blueprint $table) {
            $table->dropUnique(['cnpj_hash']);
            $table->dropColumn(['cnpj_hash', 'email_hash']);
        });
        Schema::table('company_contacts', function (Blueprint $table) {
            $table->dropIndex(['email_hash']);
            $table->dropColumn('email_hash');
        });
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex(['ip_hash']);
            $table->dropColumn('ip_hash');
        });

        $this->widen('creators', [
            'document' => 'string',
            'cpf' => 'string',
            'whatsapp' => 'string',
            'birth_date' => 'date',
            'shipping_address' => 'json',
            'pix_key' => 'string',
            'bank_account' => 'json',
            'bank_details' => 'text',
        ]);
        $this->widen('companies', [
            'cnpj' => 'string',
            'whatsapp' => 'string',
            'email' => 'string',
        ]);
        Schema::table('companies', function (Blueprint $table) {
            $table->unique('cnpj');
        });
        $this->widen('company_contacts', [
            'email' => 'string',
            'whatsapp' => 'string',
        ]);
        $this->widen('campaigns', [
            'sender_phone' => 'string',
            'sender_address' => 'json',
        ]);
        $this->widen('shipping_senders', [
            'phone' => 'string',
            'address' => 'json',
        ]);
        $this->widen('creator_contract_acceptances', [
            'document' => 'string',
            'email' => 'string',
            'ip' => 'string',
        ]);
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->string('ip', 45)->nullable()->change();
        });
    }

    /**
     * @param  array<string, string>  $columns
     */
    private function widen(string $table, array $columns): void
    {
        Schema::table($table, function (Blueprint $blueprint) use ($columns) {
            foreach ($columns as $column => $type) {
                $definition = match ($type) {
                    'longText' => $blueprint->longText($column)->nullable(),
                    'text' => $blueprint->text($column)->nullable(),
                    'json' => $blueprint->json($column)->nullable(),
                    'date' => $blueprint->date($column)->nullable(),
                    default => $blueprint->string($column)->nullable(),
                };
                $definition->change();
            }
        });
    }

    /**
     * @param  list<string>  $columns
     */
    private function encryptTable(string $table, array $columns): void
    {
        DB::table($table)->orderBy('id')->lazyById(200)->each(function (object $row) use ($table, $columns) {
            $updates = [];
            foreach ($columns as $column) {
                $plain = $this->plain($row->{$column} ?? null);
                if ($plain === null || SensitiveIndex::isCipher($plain)) {
                    continue;
                }
                $updates[$column] = Crypt::encryptString($plain);
            }
            if ($updates !== []) {
                DB::table($table)->where('id', $row->id)->update($updates);
            }
        });
    }

    private function encryptDates(string $table, string $column): void
    {
        DB::table($table)->orderBy('id')->lazyById(200)->each(function (object $row) use ($table, $column) {
            $plain = $this->plain($row->{$column} ?? null);
            if ($plain === null || SensitiveIndex::isCipher($plain)) {
                return;
            }
            if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $plain, $match) === 1) {
                $plain = $match[1];
            }
            DB::table($table)->where('id', $row->id)->update([
                $column => Crypt::encryptString($plain),
            ]);
        });
    }

    private function encryptCompanies(): void
    {
        DB::table('companies')->orderBy('id')->lazyById(200)->each(function (object $row) {
            $updates = [];
            $cnpj = $this->plain($row->cnpj ?? null);
            if ($cnpj !== null && ! SensitiveIndex::isCipher($cnpj)) {
                $updates['cnpj'] = Crypt::encryptString($cnpj);
                $updates['cnpj_hash'] = SensitiveIndex::digits($cnpj);
            }
            $email = $this->plain($row->email ?? null);
            if ($email !== null && ! SensitiveIndex::isCipher($email)) {
                $updates['email'] = Crypt::encryptString($email);
                $updates['email_hash'] = SensitiveIndex::normalized($email);
            }
            $whatsapp = $this->plain($row->whatsapp ?? null);
            if ($whatsapp !== null && ! SensitiveIndex::isCipher($whatsapp)) {
                $updates['whatsapp'] = Crypt::encryptString($whatsapp);
            }
            if ($updates !== []) {
                DB::table('companies')->where('id', $row->id)->update($updates);
            }
        });
    }

    private function encryptContacts(): void
    {
        DB::table('company_contacts')->orderBy('id')->lazyById(200)->each(function (object $row) {
            $updates = [];
            $email = $this->plain($row->email ?? null);
            if ($email !== null && ! SensitiveIndex::isCipher($email)) {
                $updates['email'] = Crypt::encryptString($email);
                $updates['email_hash'] = SensitiveIndex::normalized($email);
            }
            $whatsapp = $this->plain($row->whatsapp ?? null);
            if ($whatsapp !== null && ! SensitiveIndex::isCipher($whatsapp)) {
                $updates['whatsapp'] = Crypt::encryptString($whatsapp);
            }
            if ($updates !== []) {
                DB::table('company_contacts')->where('id', $row->id)->update($updates);
            }
        });
    }

    private function encryptActivityIps(): void
    {
        DB::table('activity_logs')->orderBy('id')->lazyById(200)->each(function (object $row) {
            $ip = $this->plain($row->ip ?? null);
            if ($ip === null || SensitiveIndex::isCipher($ip)) {
                return;
            }
            DB::table('activity_logs')->where('id', $row->id)->update([
                'ip' => Crypt::encryptString($ip),
                'ip_hash' => SensitiveIndex::ip($ip),
            ]);
        });
    }

    /**
     * @param  list<string>  $columns
     */
    private function decryptTable(string $table, array $columns): void
    {
        DB::table($table)->orderBy('id')->lazyById(200)->each(function (object $row) use ($table, $columns) {
            $updates = [];
            foreach ($columns as $column) {
                $value = $this->plain($row->{$column} ?? null);
                if ($value === null || ! SensitiveIndex::isCipher($value)) {
                    continue;
                }
                $updates[$column] = Crypt::decryptString($value);
            }
            if ($updates !== []) {
                DB::table($table)->where('id', $row->id)->update($updates);
            }
        });
    }

    private function plain(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (is_array($value) || is_object($value)) {
            $encoded = json_encode($value, JSON_UNESCAPED_UNICODE);

            return $encoded === false ? null : $encoded;
        }
        $string = (string) $value;

        return $string === '' ? null : $string;
    }
};
