<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // 允许跨域请求

// 预设正确密码，你可以在这里修改
$correct_password = "xiaochen";

$response = [
    "code" => 200,
    "msg" => "success",
    "data" => [
        "password" => $correct_password
    ]
];

echo json_encode($response);
?>
