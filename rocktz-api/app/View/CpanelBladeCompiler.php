<?php

namespace App\View;

use Illuminate\View\Compilers\BladeCompiler;

class CpanelBladeCompiler extends BladeCompiler
{
    public function compile($path = null)
    {
        if ($path) {
            $this->setPath($path);
        }

        if (is_null($this->cachePath)) {
            return;
        }

        $contents = $this->compileString($this->files->get($this->getPath()));

        if (! empty($this->getPath())) {
            $contents = $this->appendFilePath($contents);
        }

        $this->ensureCompiledDirectoryExists(
            $compiledPath = $this->getCompiledPath($this->getPath())
        );

        if (! $this->files->exists($compiledPath)) {
            $this->files->replace($compiledPath, $contents);

            return;
        }

        $compiledHash = $this->files->hash($compiledPath, 'xxh128');

        if ($compiledHash !== hash('xxh128', $contents)) {
            $this->files->replace($compiledPath, $contents);

            return;
        }

        $lastModified = $this->files->lastModified($this->getPath());

        if ($lastModified >= $this->files->lastModified($compiledPath)) {
            if (! @touch($compiledPath, $lastModified + 1)) {
                $this->files->replace($compiledPath, $contents);
            }
        }
    }
}
