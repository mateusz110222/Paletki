<?php

require_once(dirname(__FILE__) . '/../../matz/phpBB/BuildingBlocks.php');
require_once(dirname(__FILE__) . '/../phpBB/Lib.php');

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
    exit;
}

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$filename = basename(__FILE__, '.php');
$status = false;
$message = 'Unknown job';
$reply = null;

$job = Lib::GetString('job');
$process = Lib::GetString('process', INPUT_POST);
$unitSerialNumber = Lib::GetString('unitSerialNumber', INPUT_POST);
$unit = Lib::GetString('unit', INPUT_POST);
$station = Lib::GetString('station', INPUT_POST);
$dc = Lib::GetString('dc', INPUT_POST);
$parent = Lib::GetString('parent', INPUT_POST);
$child = Lib::GetString('child', INPUT_POST);

try {
    if ($job === null || $job === '') {
        header('HTTP/1.1 400 Bad Request');
    }
    $response = null;
    switch ($job) {
        case 'unitCheck':
        case 'unitFilter':
        case 'timeCheck':
        case 'parentForUnit':
        case 'childrenForUnit':
        case 'Get_Unit_Status':
            if (empty($unitSerialNumber)) {
                throw new InvalidArgumentException('unitSerialNumber parameter is required');
            }
            if ($job === 'unitCheck') {
                if (empty($process)) {
                    throw new InvalidArgumentException('process parameter is required');
                }
                $response = Unit::PerformHoldRouteCheck($unitSerialNumber, $process);
            } elseif ($job === 'unitFilter') {
                $response = Unit::Filter($unitSerialNumber);
            } elseif ($job === 'timeCheck') {
                require_once(dirname(__FILE__) . '/../phpBB/Unit.php');
                $response = LibTimeCheck($unitSerialNumber, $process, 'soldering');
                $response['status'] = isset($response['status']) && $response['status'] === 'success';
            } elseif ($job === 'parentForUnit') {
                $response = Unit::GetParent($unitSerialNumber);
            } elseif ($job === 'childrenForUnit') {
                $response = Unit::GetChildren($unitSerialNumber);
            } else {
                $response = Unit::GetStatus($unitSerialNumber);
            }
            break;

        case 'dataEntry':
            if (empty($unit) || empty($station) || empty($dc)) {
                throw new InvalidArgumentException('unit, station, and dc parameters are required');
            }
            $response = Unit::DataEntry($unit, isset($process) ? $process : '', $station, $dc);
            break;

        case 'unitLink':
            if (empty($parent) || empty($child)) {
                throw new InvalidArgumentException('parent and child parameters are required');
            }
            $response = Unit::Link($parent, $child);
            break;

        default:
            if ($job !== null && $job !== '') {
                throw new InvalidArgumentException('Unknown job: ' . $job);
            }
    }

    if ($response !== null) {
        $status = isset($response['status']) ? (bool)$response['status'] : false;
        $message = isset($response['message']) ? $response['message'] : 'Operation completed';
        if (array_key_exists('data', $response)) {
            $reply = $response['data'];
        } else {
            $emptyReply = in_array($job, array('unitCheck', 'unitFilter', 'timeCheck', 'childrenForUnit', 'unitLink'), true) ? array() : null;
            $reply = isset($response['reply']) ? $response['reply'] : $emptyReply;
        }
    }
} catch (InvalidArgumentException $e) {
    header('HTTP/1.1 400 Bad Request');
    $status = false;
    $message = 'Invalid argument: ' . $e->getMessage();
    Lib::ShowError($filename, print_r($e, true));
} catch (RuntimeException $e) {
    header('HTTP/1.1 502 Bad Gateway');
    $status = false;
    $message = 'Runtime error: ' . $e->getMessage();
    Lib::ShowError($filename, print_r($e, true));
} catch (Exception $e) {
    header('HTTP/1.1 500 Internal Server Error');
    $status = false;
    $message = 'Unexpected error: ' . $e->getMessage();
    Lib::ShowError($filename, print_r($e, true));
}

$json = json_encode(array('status' => $status, 'message' => $message, 'data' => $reply));
if ($json === false) {
    Lib::ShowError($filename, 'JSON encoding failed, error code: ' . json_last_error());
    header('HTTP/1.1 500 Internal Server Error');
    echo '{"status":false,"message":"JSON encoding failed","data":null}';
} else {
    echo $json;
}
