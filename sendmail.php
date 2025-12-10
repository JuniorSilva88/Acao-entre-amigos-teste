<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'phpmailer/src/Exception.php';
require 'phpmailer/src/PHPMailer.php';
require 'phpmailer/src/SMTP.php';

$mail = new PHPMailer(true);

try {
    $mail->SMTPDebug = 2; // Ativar debug para ver logs
    $mail->Debugoutput = 'html';

    $mail->isSMTP();
    $mail->Host = 'smtp.locaweb.com.br'; // teste com este host
    $mail->SMTPAuth = true;
    $mail->Username = 'contato@iluminandofuturos.com.br';
    $mail->Password = 'Acao2021@'; // senha atual
    $mail->SMTPSecure = 'tls';
    $mail->Port = 587;

    // remetente fixo
    $mail->setFrom('contato@iluminandofuturos.com.br', 'Site Iluminando Futuros');
    // destinatário
    $mail->addAddress('contato@iluminandofuturos.com.br');
    $mail->Subject = 'Novo contato do site';
    $mail->Body = "Nome: {$_POST['nome']}\nEmail: {$_POST['email']}\nMensagem:\n{$_POST['mensagem']}";

    $mail->send();
    echo 'Mensagem enviada com sucesso!';
} catch (Exception $e) {
    echo 'Erro ao enviar: ', $mail->ErrorInfo;
}
?>
