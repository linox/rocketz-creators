<?php

namespace Tests\Unit;

use App\View\CpanelBladeCompiler;
use Illuminate\Filesystem\Filesystem;
use Tests\TestCase;

class CpanelBladeCompilerTest extends TestCase
{
    public function test_compile_does_not_throw_when_compiled_view_already_exists(): void
    {
        $dir = storage_path('framework/views');
        $compiler = new CpanelBladeCompiler(
            new Filesystem,
            $dir,
            '',
            true,
            'php',
            true,
        );

        $path = resource_path('views/mail/layout.blade.php');
        $compiler->compile($path);
        $compiler->compile($path);

        $this->assertFileExists($compiler->getCompiledPath($path));
    }
}
