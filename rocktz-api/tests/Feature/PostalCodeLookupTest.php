<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PostalCodeLookupTest extends TestCase
{
    use RefreshDatabase;

    public function test_brazilian_postal_code_fills_the_street_address(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'viacep.com.br/*' => Http::response([
                'cep' => '01310-100',
                'logradouro' => 'Avenida Paulista',
                'bairro' => 'Bela Vista',
                'localidade' => 'São Paulo',
                'uf' => 'SP',
            ]),
        ]);

        $this->withToken($this->token())
            ->getJson('/api/postal-codes?country=BR&code=01310-100')
            ->assertOk()
            ->assertJsonPath('data.country', 'BR')
            ->assertJsonPath('data.zip', '01310100')
            ->assertJsonPath('data.street', 'Avenida Paulista')
            ->assertJsonPath('data.neighborhood', 'Bela Vista')
            ->assertJsonPath('data.city', 'São Paulo')
            ->assertJsonPath('data.state', 'SP');
    }

    public function test_foreign_postal_code_sets_the_country(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'api.zippopotam.us/*' => Http::response([
                'post code' => '90210',
                'country' => 'United States',
                'country abbreviation' => 'US',
                'places' => [[
                    'place name' => 'Beverly Hills',
                    'state' => 'California',
                    'state abbreviation' => 'CA',
                ]],
            ]),
            'nominatim.openstreetmap.org/*' => Http::response([[
                'address' => [
                    'road' => 'Rodeo Drive',
                    'suburb' => 'Beverly Hills',
                    'city' => 'Beverly Hills',
                    'state' => 'California',
                    'ISO3166-2-lvl4' => 'US-CA',
                    'country_code' => 'us',
                    'postcode' => '90210',
                ],
            ]]),
        ]);

        $this->withToken($this->token())
            ->getJson('/api/postal-codes?country=US&code=90210')
            ->assertOk()
            ->assertJsonPath('data.country', 'US')
            ->assertJsonPath('data.street', 'Rodeo Drive')
            ->assertJsonPath('data.neighborhood', 'Beverly Hills')
            ->assertJsonPath('data.city', 'Beverly Hills')
            ->assertJsonPath('data.state', 'CA');
    }

    public function test_unknown_postal_code_returns_not_found(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'viacep.com.br/*' => Http::response(['erro' => true]),
        ]);

        $this->withToken($this->token())
            ->getJson('/api/postal-codes?country=BR&code=00000000')
            ->assertNotFound()
            ->assertJsonPath('message', __('auth.postal_code_not_found'));
    }

    private function token(): string
    {
        return User::factory()->create()->createToken('auth')->plainTextToken;
    }
}
