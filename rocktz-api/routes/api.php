<?php

use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CampaignController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\CreatorController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\RecurringContractController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::prefix('auth')->group(function () {
    Route::post('register/creator', [AuthController::class, 'registerCreator']);
    Route::post('register/company', [AuthController::class, 'registerCompany']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);
    Route::get('google/redirect', [AuthController::class, 'googleRedirect']);
    Route::get('google/callback', [AuthController::class, 'googleCallback']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::patch('me', [AuthController::class, 'updateMe']);
        Route::patch('locale', [AuthController::class, 'updateLocale']);
        Route::post('google/complete', [AuthController::class, 'completeGoogleProfile']);
    });
});

Route::middleware(['auth:sanctum', 'actor'])->group(function () {
    Route::post('media', [MediaController::class, 'store']);
    Route::get('dashboard', DashboardController::class);

    Route::get('creators', [CreatorController::class, 'index']);
    Route::get('creators/{creator}', [CreatorController::class, 'show']);
    Route::patch('creators/{creator}', [CreatorController::class, 'update']);
    Route::post('creators/{creator}/portfolio', [CreatorController::class, 'storePortfolio']);
    Route::delete('creators/{creator}/portfolio/{video}', [CreatorController::class, 'destroyPortfolio']);
    Route::post('creators/{creator}/contract', [CreatorController::class, 'acceptContract']);

    Route::get('companies', [CompanyController::class, 'index']);
    Route::get('companies/{company}', [CompanyController::class, 'show']);
    Route::patch('companies/{company}', [CompanyController::class, 'update']);
    Route::post('companies/{company}/favorites/{creator}', [CompanyController::class, 'toggleFavorite']);

    Route::get('campaigns', [CampaignController::class, 'index']);
    Route::get('campaigns/available', [CampaignController::class, 'available']);
    Route::get('campaigns/{campaign}', [CampaignController::class, 'show']);
    Route::post('campaigns/{campaign}/apply', [CampaignController::class, 'apply']);
    Route::patch('campaign-creators/{campaignCreator}', [CampaignController::class, 'updateParticipation']);

    Route::get('recurring-contracts', [RecurringContractController::class, 'index']);
    Route::get('recurring-contracts/{recurringContract}', [RecurringContractController::class, 'show']);
    Route::patch('content-planning-items/{contentPlanningItem}', [RecurringContractController::class, 'updateItem']);

    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);

    Route::middleware('role:admin,company')->group(function () {
        Route::post('campaigns', [CampaignController::class, 'store']);
        Route::patch('campaigns/{campaign}', [CampaignController::class, 'update']);
        Route::post('recurring-contracts', [RecurringContractController::class, 'store']);
        Route::patch('recurring-contracts/{recurringContract}', [RecurringContractController::class, 'update']);
        Route::post('recurring-contracts/{recurringContract}/creators', [RecurringContractController::class, 'attachCreator']);
        Route::post('recurring-contracts/{recurringContract}/generate-month-demands', [RecurringContractController::class, 'generateMonthDemands']);
        Route::delete('recurring-contracts/{recurringContract}/creators/{recurringContractCreator}', [RecurringContractController::class, 'detachCreator']);
        Route::post('recurring-contracts/{recurringContract}/items', [RecurringContractController::class, 'storeItem']);
        Route::delete('content-planning-items/{contentPlanningItem}', [RecurringContractController::class, 'destroyItem']);
    });

    Route::middleware('role:admin')->group(function () {
        Route::middleware('permission:creators.moderate')->group(function () {
            Route::post('creators', [CreatorController::class, 'store']);
            Route::post('creators/{creator}/approve', [CreatorController::class, 'approve']);
            Route::post('creators/{creator}/reject', [CreatorController::class, 'reject']);
        });

        Route::middleware('permission:companies.moderate')->group(function () {
            Route::post('companies', [CompanyController::class, 'store']);
            Route::post('companies/{company}/approve', [CompanyController::class, 'approve']);
            Route::post('companies/{company}/reject', [CompanyController::class, 'reject']);
        });

        Route::middleware('permission:campaigns.assign')->group(function () {
            Route::post('campaigns/{campaign}/assign', [CampaignController::class, 'assign']);
            Route::delete('campaign-creators/{campaignCreator}', [CampaignController::class, 'destroyParticipation']);
        });

        Route::delete('campaigns/{campaign}', [CampaignController::class, 'destroy']);
        Route::delete('recurring-contracts/{recurringContract}', [RecurringContractController::class, 'destroy']);

        Route::middleware('permission:users.manage')->group(function () {
            Route::get('users', [UserController::class, 'index']);
            Route::post('users', [UserController::class, 'store']);
            Route::patch('users/{user}', [UserController::class, 'update']);
            Route::delete('users/{user}', [UserController::class, 'destroy']);
            Route::get('admin-users', [AdminUserController::class, 'index']);
            Route::post('admin-users', [AdminUserController::class, 'store']);
            Route::delete('admin-users/{adminUser}', [AdminUserController::class, 'destroy']);
            Route::post('companies/{company}/users', [CompanyController::class, 'storeUser']);
            Route::patch('companies/{company}/users/{companyUser}', [CompanyController::class, 'updateUser']);
            Route::delete('companies/{company}/users/{companyUser}', [CompanyController::class, 'destroyUser']);
            Route::post('creators/{creator}/password', [CreatorController::class, 'updatePassword']);
        });

        Route::middleware('permission:campaigns.approve_agency')->group(function () {
            Route::post('campaigns/{campaign}/approve-agency', [CampaignController::class, 'approveAgency']);
            Route::post('recurring-contracts/{recurringContract}/approve-agency', [RecurringContractController::class, 'approveAgency']);
        });

        Route::middleware('permission:data.reset')->group(function () {
            Route::post('creators/reset-casting', [CreatorController::class, 'resetCasting']);
            Route::post('campaigns/reset', [CampaignController::class, 'reset']);
            Route::post('recurring-contracts/reset', [RecurringContractController::class, 'reset']);
        });
    });
});
