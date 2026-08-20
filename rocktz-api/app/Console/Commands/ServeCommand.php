<?php

namespace App\Console\Commands;

use Illuminate\Foundation\Console\ServeCommand as LaravelServeCommand;
use Symfony\Component\Console\Attribute\AsCommand;

#[AsCommand(name: 'serve')]
class ServeCommand extends LaravelServeCommand
{
    /**
     * php -d on `artisan serve` does not apply to the child `php -S` process.
     *
     * @return list<string>
     */
    protected function serverCommand()
    {
        $command = parent::serverCommand();

        array_splice($command, 1, 0, [
            '-d', 'upload_max_filesize=2048M',
            '-d', 'post_max_size=2048M',
            '-d', 'memory_limit=512M',
            '-d', 'max_execution_time=600',
            '-d', 'max_input_time=600',
        ]);

        return $command;
    }
}
