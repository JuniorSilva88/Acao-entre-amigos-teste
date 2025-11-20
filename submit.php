<?php
// submit.php - simples handler para receber notificações de doação e solicitações
header('Content-Type: application/json; charset=utf-8');

function send_json($success, $message=''){
    echo json_encode(['success'=> $success, 'message'=> $message]);
    exit;
}

if($_SERVER['REQUEST_METHOD'] !== 'POST'){
    send_json(false,'Método inválido');
}

$name = isset($_POST['name']) ? strip_tags(trim($_POST['name'])) : '';
$email = isset($_POST['email']) ? filter_var(trim($_POST['email']), FILTER_SANITIZE_EMAIL) : '';
$message = isset($_POST['message']) ? strip_tags(trim($_POST['message'])) : '';
$amount = isset($_POST['amount']) ? trim($_POST['amount']) : '';

if(empty($name)){
    send_json(false,'Nome é obrigatório');
}

// grava em CSV local (se pasta data existir e for gravável)
$dataDir = __DIR__ . '/data';
if(!is_dir($dataDir)){
    @mkdir($dataDir,0755,true);
}
$file = $dataDir . '/submissions.csv';
$line = [date('c'), $name, $email, $amount, $message];
try{
    $fp = fopen($file,'a');
    if($fp){
        fputcsv($fp, $line);
        fclose($fp);
    }
} catch(Exception $e){
    // ignore error silently
}

// opcional: enviar email (depende de configuração do servidor)
$to = 'contato@example.org';
$subject = 'Nova notificação de doação - Ação Entre Amigos';
$body = "Nome: $name\nEmail: $email\nValor: $amount\nMensagem: $message\n";
$headers = 'From: no-reply@example.org' . "\r\n" . 'Reply-To: ' . ($email?:'no-reply@example.org') . "\r\n";
@mail($to, $subject, $body, $headers);

send_json(true,'Enviado com sucesso');

?>
