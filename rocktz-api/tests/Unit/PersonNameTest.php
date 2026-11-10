<?php

namespace Tests\Unit;

use App\Support\PersonName;
use PHPUnit\Framework\TestCase;

class PersonNameTest extends TestCase
{
    public function test_it_accepts_a_given_name_and_a_surname(): void
    {
        $this->assertTrue(PersonName::isComplete('Ana Silva'));
        $this->assertTrue(PersonName::isComplete('  João   da   Silva  '));
        $this->assertTrue(PersonName::isComplete('Maria das Dores'));
        $this->assertTrue(PersonName::isComplete('Ana-Maria Silva'));
        $this->assertTrue(PersonName::isComplete("D'Angelo Souza"));
        $this->assertTrue(PersonName::isComplete('Li Na'));
    }

    public function test_it_rejects_a_name_without_a_surname_or_with_invalid_characters(): void
    {
        $this->assertFalse(PersonName::isComplete(null));
        $this->assertFalse(PersonName::isComplete(''));
        $this->assertFalse(PersonName::isComplete('   '));
        $this->assertFalse(PersonName::isComplete('Ana'));
        $this->assertFalse(PersonName::isComplete('Ana da'));
        $this->assertFalse(PersonName::isComplete('A Silva'));
        $this->assertFalse(PersonName::isComplete('Ana 123'));
        $this->assertFalse(PersonName::isComplete('Ana Silva!'));
        $this->assertFalse(PersonName::isComplete('José.'));
    }
}
