<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class User extends MarketplaceModel
{
    protected $table = 'User';
    protected $primaryKey = 'id';
    public $timestamps = false;
    protected $fillable = ['email', 'displayName', 'passwordHash', 'status'];
    protected $hidden = ['passwordHash'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'status' => \App\Enums\UserStatus::class,
        ];
    }

    public function studentIdentity(): HasOne
    {
        return $this->hasOne(StudentIdentity::class, 'userId', 'id');
    }

    public function affiliations(): HasMany
    {
        return $this->hasMany(Affiliation::class, 'userId', 'id');
    }

    public function roles(): HasMany
    {
        return $this->hasMany(UserRole::class, 'userId', 'id');
    }

    public function sellerProfiles(): HasMany
    {
        return $this->hasMany(SellerProfile::class, 'ownerUserId', 'id');
    }

    public function inquiryMessages(): HasMany
    {
        return $this->hasMany(InquiryMessage::class, 'authorUserId', 'id');
    }

    public function inquiryPreferences(): HasMany
    {
        return $this->hasMany(InquiryPreference::class, 'userId', 'id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(Session::class, 'userId', 'id');
    }

    public function listingReviews(): HasMany
    {
        return $this->hasMany(ListingReview::class, 'reviewerId', 'id');
    }

    public function savedListings(): HasMany
    {
        return $this->hasMany(SavedListing::class, 'userId', 'id');
    }

    public function storeFollows(): HasMany
    {
        return $this->hasMany(StoreFollow::class, 'userId', 'id');
    }

    public function storeAppreciations(): HasMany
    {
        return $this->hasMany(StoreAppreciation::class, 'userId', 'id');
    }

    public function listingAppreciations(): HasMany
    {
        return $this->hasMany(ListingAppreciation::class, 'userId', 'id');
    }

    public function buyerThreads(): HasMany
    {
        return $this->hasMany(InquiryThread::class, 'buyerUserId', 'id');
    }

    public function reportedItems(): HasMany
    {
        return $this->hasMany(Report::class, 'reporterUserId', 'id');
    }

    public function assignedReports(): HasMany
    {
        return $this->hasMany(Report::class, 'assignedReviewerId', 'id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'userId', 'id');
    }

    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class, 'userId', 'id');
    }

    public function pushPreference(): HasOne
    {
        return $this->hasOne(PushPreference::class, 'userId', 'id');
    }

    public function pushOutbox(): HasMany
    {
        return $this->hasMany(PushOutbox::class, 'userId', 'id');
    }

    public function pushDailyBudgets(): HasMany
    {
        return $this->hasMany(PushDailyBudget::class, 'userId', 'id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'actorUserId', 'id');
    }

    public function buyingTransactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'buyerUserId', 'id');
    }

    public function sellingTransactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'sellerUserId', 'id');
    }

    public function transactionEvents(): HasMany
    {
        return $this->hasMany(TransactionStatusLog::class, 'actorUserId', 'id');
    }

    public function authoredStoreReviews(): HasMany
    {
        return $this->hasMany(StoreReview::class, 'buyerUserId', 'id');
    }
}
