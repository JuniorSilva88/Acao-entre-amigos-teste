<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'phpmailer/src/Exception.php';
require 'phpmailer/src/PHPMailer.php';
require 'phpmailer/src/SMTP.php';

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host = 'smtp.iluminandofuturos.com.br';
    $mail->SMTPAuth = true;
    $mail->Username = 'contato@iluminandofuturos.com.br'; // seu e-mail
    $mail->Password = 'SUA_SENHA_AQUI'; // senha definida
    $mail->SMTPSecure = 'tls';
    $mail->Port = 587;

    // remetente (quem preencheu o formulário)
    $mail->setFrom($_POST['email'], $_POST['nome']);
    // destinatário (sua caixa de entrada)
    $mail->addAddress('contato@iluminandofuturos.com.br');
    $mail->Subject = 'Novo contato do site';
    $mail->Body = "Nome: {$_POST['nome']}\nEmail: {$_POST['email']}\nMensagem:\n{$_POST['mensagem']}";

    $mail->send();
    echo 'Mensagem enviada com sucesso!';
} catch (Exception $e) {
    echo 'Erro ao enviar: ', $mail->ErrorInfo;
}
?>
