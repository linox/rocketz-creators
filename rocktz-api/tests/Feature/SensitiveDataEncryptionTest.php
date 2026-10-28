<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Company;
use App\Models\CompanyContact;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Support\SensitiveIndex;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SensitiveDataEncryptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_personal_and_payment_data_is_encrypted_at_rest(): void
    {
        $creator = Creator::factory()->create([
            'cpf' => '123.456.789-09',
            'document' => '123.456.789-09',
            'whatsapp' => '11999998888',
            'birth_date' => '1990-01-01',
            'pix_key' => 'ana@pix.test',
            'shipping_address' => [
                'street' => 'Rua Secreta',
                'number' => '10',
                'city' => 'São Paulo',
                'state' => 'SP',
                'zip' => '01310100',
                'country' => 'BR',
            ],
            'bank_account' => [
                'holder_name' => 'Ana Silva',
                'bank_name' => 'Nubank',
                'agency' => '0001',
                'account' => '12345-6',
                'account_type' => 'checking',
                'pix_type' => 'email',
                'pix_key' => 'ana@pix.test',
            ],
        ]);

        $raw = DB::table('creators')->where('id', $creator->id)->first();
        $this->assertIsString($raw->cpf);
        $this->assertStringNotContainsString('123.456.789-09', $raw->cpf);
        $this->assertStringNotContainsString('11999998888', (string) $raw->whatsapp);
        $this->assertStringNotContainsString('1990-01-01', (string) $raw->birth_date);
        $this->assertStringNotContainsString('Rua Secreta', (string) $raw->shipping_address);
        $this->assertStringNotContainsString('12345-6', (string) $raw->bank_account);

        $fresh = $creator->fresh();
        $this->assertSame('123.456.789-09', $fresh->cpf);
        $this->assertSame('11999998888', $fresh->whatsapp);
        $this->assertSame('1990-01-01', $fresh->birth_date?->toDateString());
        $this->assertSame('Rua Secreta', $fresh->shipping_address['street']);
        $this->assertSame('12345-6', $fresh->bank_account['account']);
        $this->assertGreaterThan(0, $fresh->birth_date?->age);
    }

    public function test_company_documents_keep_a_lookup_hash(): void
    {
        $company = Company::factory()->create([
            'cnpj' => '12.345.678/0001-90',
            'email' => 'sigilo@empresa.test',
            'whatsapp' => '11988887777',
        ]);
        $contact = CompanyContact::factory()->create([
            'company_id' => $company->id,
            'email' => 'marina@empresa.test',
            'whatsapp' => '11977776666',
        ]);

        $rawCompany = DB::table('companies')->where('id', $company->id)->first();
        $rawContact = DB::table('company_contacts')->where('id', $contact->id)->first();
        $this->assertStringNotContainsString('12.345.678/0001-90', (string) $rawCompany->cnpj);
        $this->assertStringNotContainsString('sigilo@empresa.test', (string) $rawCompany->email);
        $this->assertStringNotContainsString('marina@empresa.test', (string) $rawContact->email);
        $this->assertSame(SensitiveIndex::digits('12.345.678/0001-90'), $rawCompany->cnpj_hash);
        $this->assertSame(SensitiveIndex::normalized('sigilo@empresa.test'), $rawCompany->email_hash);
        $this->assertSame(
            $company->id,
            Company::query()->where('cnpj_hash', SensitiveIndex::digits('12.345.678/0001-90'))->value('id'),
        );
        $this->assertSame('12.345.678/0001-90', $company->fresh()->cnpj);
    }

    public function test_contract_snapshot_and_access_ip_are_encrypted(): void
    {
        $creator = Creator::factory()->create();
        $acceptance = CreatorContractAcceptance::factory()->create([
            'creator_id' => $creator->id,
            'document' => '123.456.789-09',
            'email' => 'ana@example.com',
            'ip' => '203.0.113.10',
        ]);
        $log = ActivityLog::query()->create([
            'category' => 'access',
            'action' => 'login.success',
            'ip' => '203.0.113.10',
        ]);

        $rawAcceptance = DB::table('creator_contract_acceptances')->where('id', $acceptance->id)->first();
        $rawLog = DB::table('activity_logs')->where('id', $log->id)->first();
        $this->assertStringNotContainsString('123.456.789-09', (string) $rawAcceptance->document);
        $this->assertStringNotContainsString('203.0.113.10', (string) $rawLog->ip);
        $this->assertSame(SensitiveIndex::ip('203.0.113.10'), $rawLog->ip_hash);
        $this->assertSame('203.0.113.10', $log->fresh()->ip);
        $this->assertSame('ana@example.com', $acceptance->fresh()->email);
    }
}
