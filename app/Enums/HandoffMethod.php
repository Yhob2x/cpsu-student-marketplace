<?php

namespace App\Enums;

enum HandoffMethod: string
{
    case campus_pickup = 'campus_pickup';
    case scheduled_meeting = 'scheduled_meeting';
    case seller_delivery = 'seller_delivery';
    case off_campus = 'off_campus';
    case digital_delivery = 'digital_delivery';
    case appointment = 'appointment';
}
