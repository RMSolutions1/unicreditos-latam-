# @unicreditos/auth

JWT compartido entre servicios: `JwtStrategy`, `JwtAuthGuard`, `RolesGuard` + `@Roles(...)`, y los
tipos `AuthenticatedUser`/`AuthenticatedRequest`. `identity` emite los tokens; cualquier otro
servicio que valide el mismo `JWT_ACCESS_SECRET` puede usar este paquete para protegerse.

Cada servicio que lo use debe registrar `PassportModule` y `JwtStrategy` en su propio `AppModule`
(Nest no comparte el registro global de estrategias de passport entre módulos automáticamente).
