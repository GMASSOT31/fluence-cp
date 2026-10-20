-- La demande de places est réservée aux comptes enseignants connectés.
revoke execute on function public.teacher_request_seats(integer) from anon;
