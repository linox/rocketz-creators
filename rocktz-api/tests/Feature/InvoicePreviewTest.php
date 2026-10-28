<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class InvoicePreviewTest extends TestCase
{
    public function test_signed_preview_opens_a_pdf_inline(): void
    {
        Storage::fake('uploads');
        Storage::disk('uploads')->put('documents/nota-teste.pdf', "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

        $url = URL::temporarySignedRoute(
            'media.documents.preview',
            now()->addHour(),
            ['filename' => 'nota-teste.pdf'],
            false,
        );

        $response = $this->get($url);

        $response->assertOk();
        $this->assertStringContainsString('inline', (string) $response->headers->get('content-disposition'));
        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
    }

    public function test_preview_without_signature_is_forbidden(): void
    {
        Storage::fake('uploads');
        Storage::disk('uploads')->put('documents/nota-teste.pdf', '%PDF-1.4');

        $this->get('/preview/documents/nota-teste.pdf')->assertForbidden();
    }
}
