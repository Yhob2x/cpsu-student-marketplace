<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AdminAnalyticsController;
use App\Http\Controllers\Api\AdminContentController;
use App\Http\Controllers\Api\AdminReviewController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogAdminController;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\HomePageAdminController;
use App\Http\Controllers\Api\InquiryController;
use App\Http\Controllers\Api\ListingController;
use App\Http\Controllers\Api\ListingEngagementController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\PushController;
use App\Http\Controllers\Api\SellerAnalyticsController;
use App\Http\Controllers\Api\SellerListingController;
use App\Http\Controllers\Api\SellerStoreController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\StoreFollowController;
use App\Http\Controllers\Api\StoreReviewController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Middleware\AccountLoginThrottle;
use App\Http\Middleware\AccountRateLimit;
use App\Http\Middleware\ApiRateLimit;
use App\Http\Middleware\ApiResponseHeaders;
use App\Http\Middleware\AuthenticateAccessToken;
use App\Http\Middleware\AvatarUploadThrottle;
use App\Http\Middleware\ParseJsonBody;
use App\Http\Middleware\RequireAuth;
use App\Http\Middleware\RequireReviewer;
use App\Http\Middleware\RequireStudent;
use App\Http\Middleware\RequireUniversityAdmin;
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
        Route::get('seller-profiles/{id}/reviews', [StoreReviewController::class, 'publicReviews']);

        Route::get('media/seller-avatar/{id}', [MediaController::class, 'sellerAvatar']);
        Route::get('media/{id}', [MediaController::class, 'listingMedia']);

        Route::middleware(RequireAuth::class)->group(function () {
            Route::get('me', [AccountController::class, 'me']);
            Route::patch('me', [AccountController::class, 'updateMe']);
            Route::get('notifications/unread-count', [AccountController::class, 'unreadCount']);
            Route::get('notifications', [AccountController::class, 'notifications']);
            Route::post('notifications/read', [AccountController::class, 'readAll']);
            Route::post('notifications/{id}/read', [AccountController::class, 'readOne']);

            Route::prefix('push')->middleware(AccountRateLimit::class.':push,40')->group(function () {
                Route::get('config', [PushController::class, 'config']);
                Route::post('subscriptions/status', [PushController::class, 'status']);
                Route::get('preferences', [PushController::class, 'preferences']);
                Route::patch('preferences', [PushController::class, 'updatePreferences']);
                Route::post('subscriptions', [PushController::class, 'subscribe']);
                Route::delete('subscriptions', [PushController::class, 'unsubscribe']);
            });
        });

        Route::middleware(RequireStudent::class)->group(function () {
            Route::get('saved', [AccountController::class, 'saved']);
            Route::put('saved/{listingId}', [AccountController::class, 'save']);
            Route::delete('saved/{listingId}', [AccountController::class, 'unsave']);
            Route::post('reports', [AccountController::class, 'report']);

            Route::put('listing-appreciations/{id}', [ListingEngagementController::class, 'appreciate']);
            Route::delete('listing-appreciations/{id}', [ListingEngagementController::class, 'withdraw']);

            Route::get('store-follows/mine', [StoreFollowController::class, 'mine']);
            Route::put('store-follows/{id}', [StoreFollowController::class, 'follow']);
            Route::delete('store-follows/{id}', [StoreFollowController::class, 'unfollow']);

            Route::get('seller-profiles/{id}/review-opportunities', [StoreReviewController::class, 'opportunities']);
            Route::get('transactions/{id}/store-review', [StoreReviewController::class, 'forTransaction']);
            Route::post('transactions/{id}/store-review', [StoreReviewController::class, 'submit']);

            Route::prefix('seller')->group(function () {
                Route::get('analytics', [SellerAnalyticsController::class, 'show']);
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

            Route::prefix('inquiries')->group(function () {
                Route::get('/', [InquiryController::class, 'index']);
                Route::post('/', [InquiryController::class, 'create']);
                Route::get('{id}/messages', [InquiryController::class, 'messages']);
                Route::post('{id}/messages', [InquiryController::class, 'send']);
                Route::post('{id}/presence', [InquiryController::class, 'presence']);
                Route::post('{id}/seen', [InquiryController::class, 'seen']);
                Route::post('{id}/typing', [InquiryController::class, 'typing']);
                Route::patch('{id}/preferences', [InquiryController::class, 'preferences']);
                Route::post('{id}/hide', [InquiryController::class, 'hide']);
                Route::post('{id}/close', [InquiryController::class, 'close']);
                Route::put('{id}/handoff', [InquiryController::class, 'handoff']);
            });

            Route::prefix('transactions')->group(function () {
                Route::post('/', [TransactionController::class, 'create']);
                Route::get('/', [TransactionController::class, 'index']);
                Route::get('{id}', [TransactionController::class, 'show']);
                Route::post('{id}/decision', [TransactionController::class, 'decision']);
                Route::post('{id}/negotiating', [TransactionController::class, 'negotiating']);
                Route::put('{id}/meetup-location', [TransactionController::class, 'meetupLocation']);
                Route::post('{id}/confirm-meetup', [TransactionController::class, 'confirmMeetup']);
                Route::post('{id}/confirm-completion', [TransactionController::class, 'confirmCompletion']);
                Route::post('{id}/cancel', [TransactionController::class, 'cancel']);
            });
        });

        Route::prefix('admin')->group(function () {
            Route::middleware(RequireUniversityAdmin::class)->group(function () {
                Route::prefix('reviewers')->group(function () {
                    Route::get('/', [AdminUserController::class, 'reviewers']);
                    Route::post('/', [AdminUserController::class, 'createReviewer']);
                    Route::patch('{id}', [AdminUserController::class, 'updateReviewer']);
                });

                Route::prefix('catalog')->group(function () {
                    Route::get('/', [CatalogAdminController::class, 'index']);
                    Route::post('campuses', [CatalogAdminController::class, 'createCampus']);
                    Route::patch('campuses/{id}', [CatalogAdminController::class, 'updateCampus']);
                    Route::post('services', [CatalogAdminController::class, 'createService']);
                    Route::patch('services/{id}', [CatalogAdminController::class, 'updateService']);
                    Route::post('categories', [CatalogAdminController::class, 'createCategory']);
                    Route::patch('categories/{id}', [CatalogAdminController::class, 'updateCategory']);
                });

                Route::prefix('content/home-page')->group(function () {
                    Route::get('/', [HomePageAdminController::class, 'show']);
                    Route::put('/', [HomePageAdminController::class, 'saveCopy']);
                    Route::post('publish', [HomePageAdminController::class, 'publish']);
                    Route::get('images/{slot}', [HomePageAdminController::class, 'image']);
                    Route::post('images/{slot}', [HomePageAdminController::class, 'uploadImage'])->middleware(AccountRateLimit::class.':homepage-image,8');
                    Route::delete('images/{slot}', [HomePageAdminController::class, 'removeImage']);
                });

                Route::get('content/guidelines', [AdminContentController::class, 'guidelines']);
                Route::put('content/guidelines', [AdminContentController::class, 'saveGuidelines']);
                Route::post('content/guidelines/publish', [AdminContentController::class, 'publishGuidelines']);
                Route::get('content/announcements', [AdminContentController::class, 'announcements']);
                Route::post('content/announcements', [AdminContentController::class, 'createAnnouncement']);
                Route::patch('content/announcements/{id}', [AdminContentController::class, 'updateAnnouncement']);
                Route::post('content/announcements/{id}/publish', [AdminContentController::class, 'publishAnnouncement']);
                Route::post('content/announcements/{id}/archive', [AdminContentController::class, 'archiveAnnouncement']);

                Route::get('audit-logs', [AdminUserController::class, 'auditLogs']);
                Route::get('users', [AdminUserController::class, 'users']);
                Route::post('users/{id}/assign-reviewer', [AdminUserController::class, 'assignReviewer']);
                Route::patch('users/{id}/status', [AdminUserController::class, 'updateStatus']);
            });

            Route::middleware(RequireReviewer::class)->group(function () {
                Route::get('store-reviews', [StoreReviewController::class, 'adminIndex']);
                Route::post('store-reviews/{id}/decision', [StoreReviewController::class, 'adminDecision']);

                Route::get('review-queue', [AdminReviewController::class, 'queue']);
                Route::post('listings/{id}/decision', [AdminReviewController::class, 'decideListing']);
                Route::post('affiliations/{id}/verify', [AdminReviewController::class, 'verifyAffiliation']);
                Route::post('listings/{id}/suspend', [AdminReviewController::class, 'suspendListing']);
                Route::get('transactions', [AdminReviewController::class, 'transactions']);
                Route::get('reports', [AdminReviewController::class, 'reports']);
                Route::post('reports/{id}/resolve', [AdminReviewController::class, 'resolveReport']);
                Route::get('analytics/overview', [AdminReviewController::class, 'analytics']);
                Route::get('analytics/dashboard', [AdminAnalyticsController::class, 'show']);
            });
        });
    });
