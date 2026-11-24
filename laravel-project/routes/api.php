<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\ListingController;
use App\Http\Controllers\Api\ListingEngagementController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\SellerListingController;
use App\Http\Controllers\Api\SellerStoreController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\StoreFollowController;
use App\Http\Controllers\LegacyApiProxyController;
use App\Http\Middleware\AccountLoginThrottle;
use App\Http\Middleware\ApiRateLimit;
use App\Http\Middleware\ApiResponseHeaders;
use App\Http\Middleware\AuthenticateAccessToken;
use App\Http\Middleware\AvatarUploadThrottle;
use App\Http\Middleware\ParseJsonBody;
use App\Http\Middleware\RequireStudent;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')
    ->middleware([ApiResponseHeaders::class, ParseJsonBody::class, ApiRateLimit::class.':global', AuthenticateAccessToken::class])
    ->group(function () {
        Route::prefix('auth')->middleware(ApiRateLimit::class.':auth')->group(function () {
            Route::get('registration-policy', [AuthController::class, 'registrationPolicy']);
            Route::post('register', [AuthController::class, 'register']);
            Route::post('login', [AuthController::class, 'login'])->middleware(AccountLoginThrottle::class);
            Route::post('refresh', [AuthController::class, 'refresh']);
            Route::post('logout', [AuthController::class, 'logout']);
        });

        Route::get('campuses', [CatalogController::class, 'campuses']);
        Route::get('categories', [CatalogController::class, 'categories']);
        Route::get('guidelines', [CatalogController::class, 'guidelines']);
        Route::get('announcements', [CatalogController::class, 'announcements']);
        Route::get('home-page', [CatalogController::class, 'homePage']);
        Route::get('home-page/images/{slot}', [CatalogController::class, 'homeImage']);

        Route::get('listings', [ListingController::class, 'index']);
        Route::get('listings/popular', [ListingController::class, 'popular']);
        Route::get('listings/fresh', [ListingController::class, 'fresh']);
        Route::get('listings/{id}', [ListingController::class, 'show']);
        Route::get('listings/{id}/appreciations', [ListingEngagementController::class, 'appreciation']);
        Route::post('listings/{id}/view', [ListingEngagementController::class, 'recordView']);
        Route::get('listing-appreciations', [ListingEngagementController::class, 'appreciationSummaries']);
        Route::get('listing-views', [ListingEngagementController::class, 'viewCounts']);

        Route::get('stores/most-followed', [StoreController::class, 'mostFollowed']);
        Route::get('seller-profiles/by-slug/{slug}', [StoreController::class, 'bySlug']);
        Route::get('seller-profiles/{id}', [StoreController::class, 'show']);
        Route::get('seller-profiles/{id}/connections', [StoreController::class, 'connections']);

        Route::get('media/seller-avatar/{id}', [MediaController::class, 'sellerAvatar']);
        Route::get('media/{id}', [MediaController::class, 'listingMedia']);

        Route::middleware(RequireStudent::class)->group(function () {
            Route::put('listing-appreciations/{id}', [ListingEngagementController::class, 'appreciate']);
            Route::delete('listing-appreciations/{id}', [ListingEngagementController::class, 'withdraw']);

            Route::get('store-follows/mine', [StoreFollowController::class, 'mine']);
            Route::put('store-follows/{id}', [StoreFollowController::class, 'follow']);
            Route::delete('store-follows/{id}', [StoreFollowController::class, 'unfollow']);

            Route::prefix('seller')->group(function () {
                Route::post('store', [SellerStoreController::class, 'create']);
                Route::get('store', [SellerStoreController::class, 'show']);
                Route::patch('store', [SellerStoreController::class, 'update']);
                Route::post('store/avatar', [SellerStoreController::class, 'uploadAvatar'])->middleware(AvatarUploadThrottle::class);
                Route::delete('store/avatar', [SellerStoreController::class, 'removeAvatar']);

                Route::get('listings', [SellerListingController::class, 'index']);
                Route::post('listings', [SellerListingController::class, 'create']);
                Route::patch('listings/{id}', [SellerListingController::class, 'update']);
                Route::delete('listings/{id}', [SellerListingController::class, 'destroy']);
                Route::post('listings/{id}/media', [SellerListingController::class, 'addMedia']);
                Route::patch('listings/{id}/media/cover', [SellerListingController::class, 'setCover']);
                Route::post('listings/{id}/submit', [SellerListingController::class, 'submit']);
                Route::patch('listings/{id}/availability', [SellerListingController::class, 'availability']);
            });
        });
    });

// Temporary migration bridge: routes not yet ported to Laravel continue to reach Express locally.
if (app()->environment('local') && config('services.legacy_api.url')) {
    Route::any('{path}', LegacyApiProxyController::class)->where('path', '.*');
}
