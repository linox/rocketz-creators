<?php

namespace Tests\Unit;

use App\Support\ProhibitedStorefrontLink;
use Tests\TestCase;

class ProhibitedStorefrontLinkTest extends TestCase
{
    public function test_it_blocks_tigrinho_and_similar_gambling_links(): void
    {
        $this->assertTrue(ProhibitedStorefrontLink::blocked('https://ganheagora.com/tigrinho'));
        $this->assertTrue(ProhibitedStorefrontLink::blocked('https://example.com/oferta', 'Cupom Tigrinho'));
        $this->assertTrue(ProhibitedStorefrontLink::blocked('https://fortune-tiger.bet/play'));
        $this->assertTrue(ProhibitedStorefrontLink::blocked('https://loja.com', 'Jogo do bicho'));
        $this->assertFalse(ProhibitedStorefrontLink::blocked('https://lojaoficial.com/desconto', 'Cupom da marca'));
    }
}
