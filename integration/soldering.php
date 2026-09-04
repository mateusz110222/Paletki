<?php
declare(strict_types=1);

require("../../matz/phpBB/BuildingBlocks.php");
use BuildingBlocks\Lib;
use BuildingBlocks\Unit;

date_default_timezone_set('Europe/Warsaw');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, GET, DELETE, PUT, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: token, Content-Type');
    header('Access-Control-Max-Age: 1728000');
    header('Content-Length: 0');
    header('Content-Type: text/plain');
    die();
}

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$filename = basename(__FILE__, ".php");

$status = false;
$message = 'Unknown job';
$reply = null;

$job = Lib::GetString('job');
$process = Lib::GetString('process',INPUT_POST);
$unitSerialNumber = Lib::GetString('unitSerialNumber',INPUT_POST);
$unit = Lib::GetString('unit',INPUT_POST);
$station = Lib::GetString('station',INPUT_POST);
$dc = Lib::GetString('dc',INPUT_POST);
$parent = Lib::GetString('parent',INPUT_POST);
$child = Lib::GetString('child',INPUT_POST);

if ($job === '') {
    http_response_code(400);
    try {
        echo json_encode([
            'status' => false,
            'message' => $message,
            'data' => $reply,
        ], JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        Lib::ShowError($filename, "JSON encoding failed: " . print_r($e, true));
        http_response_code(500);
    }
    exit;
}

try {
    switch ($job) {
        case 'unitCheck':
            if (empty($unitSerialNumber)) {
                throw new InvalidArgumentException("unitSerialNumber parameter is required");
            }
            if (empty($process)) {
                throw new InvalidArgumentException("process parameter is required");
            }

            $response = Unit::PerformHoldRouteCheck($unitSerialNumber, $process);
            $status = $response['status'] ?? false;
            $message = $response['message'] ?? "Route check passed";
            $reply = $response['data'] ?? [];
            break;

        case 'unitFilter':
            if (empty($unitSerialNumber)) {
                throw new InvalidArgumentException("unitSerialNumber parameter is required");
            }

            $response = Unit::Filter($unitSerialNumber);
            $status = $response['status'] ?? false;
            $message = $response['message'] ?? "Unit filtered";
            $reply = $response['reply'] ?? [];
            break;

        case 'timeCheck':
            if (empty($unitSerialNumber)) {
                throw new InvalidArgumentException("unitSerialNumber parameter is required");
            }

            $response = Lib::TimeCheck($unitSerialNumber);
            $status = $response['status'] ?? false;
            $message = $response['message'] ?? "Time check passed";
            $reply = $response['reply'] ?? [];
            break;

        case 'parentForUnit':
            if (empty($unitSerialNumber)) {
                throw new InvalidArgumentException("unitSerialNumber parameter is required");
            }

            $response = Unit::GetParent($unitSerialNumber);
            $status = $response['status'] ?? false;
            $message = $response['message'] ?? "Parent found";
            $reply = $response['reply'] ?? null;
            break;

        case 'childrenForUnit':
            if (empty($unitSerialNumber)) {
                throw new InvalidArgumentException("unitSerialNumber parameter is required");
            }

            $response = Unit::GetChildren($unitSerialNumber);
            $status = $response['status'] ?? false;
            $message = $response['message'] ?? "Children found";
            $reply = $response['reply'] ?? [];
            break;

        case 'Get_Unit_Status':
            if (empty($unitSerialNumber)) {
                throw new InvalidArgumentException("unitSerialNumber parameter is required");
            }

            $response = Unit::GetStatus($unitSerialNumber);
            $status = $response['status'] ?? false;
            $message = $response['message'] ?? "Unit details retrieved";
            $reply = $response['reply'] ?? null;

            break;

        case 'dataEntry':
            if (empty($unit) || empty($station) || empty($dc)) {
                throw new InvalidArgumentException("unit, station, and dc parameters are required");
            }

            $response = Unit::DataEntry($unit, $process ?? '', $station, $dc);
            $status = $response['status'] ?? false;
            $message = $response['message'] ?? "Data entry completed";
            $reply = $response['reply'] ?? null;
            break;

        case 'unitLink':
            if (empty($parent) || empty($child)) {
                throw new InvalidArgumentException("parent and child parameters are required");
            }

            $response = Unit::Link($parent, $child);
            $status = $response['status'] ?? false;
            $message = $response['message'] ?? "Unit link completed";
            $reply = $response['reply'] ?? [];
            break;

        default:
            throw new InvalidArgumentException("Unknown job: $job");
    }
} catch (InvalidArgumentException $e) {
    http_response_code(400);
    $message = "Invalid argument: " . $e->getMessage();
    Lib::ShowError($filename, print_r($e, true));
} catch (RuntimeException $e) {
    http_response_code(502);
    $message = "Runtime error: " . $e->getMessage();
    Lib::ShowError($filename, print_r($e, true));
} catch (Throwable $e) {
    http_response_code(500);
    $message = "Unexpected error: " . $e->getMessage();
    Lib::ShowError($filename, print_r($e, true));
}

try {
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'data' => $reply,
    ], JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    Lib::ShowError($filename, "JSON encoding failed: " . $e->getMessage());
    http_response_code(500);
}
