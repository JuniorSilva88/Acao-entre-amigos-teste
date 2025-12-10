<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'phpmailer/src/Exception.php';
require 'phpmailer/src/PHPMailer.php';
require 'phpmailer/src/SMTP.php';

header('Content-Type: application/json'); // resposta em JSON

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = 'smtp.locaweb.com.br';
    $mail->SMTPAuth = true;
    $mail->Username = 'contato@iluminandofuturos.com.br';
    $mail->Password = 'Acao2021@';
    $mail->SMTPSecure = 'tls';
    $mail->Port = 587;

    $mail->setFrom('contato@iluminandofuturos.com.br', 'Site Iluminando Futuros');
    $mail->addAddress('contato@iluminandofuturos.com.br');
    $mail->Subject = 'Novo contato do site';
    $mail->Body = "Nome: {$_POST['nome']}\nEmail: {$_POST['email']}\nMensagem:\n{$_POST['mensagem']}";

    $mail->send();
    echo json_encode(["status" => "ok"]);
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $mail->ErrorInfo]);
}
?>
