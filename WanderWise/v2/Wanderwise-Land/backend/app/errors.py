class AppError(Exception):
    def __init__(self,code,message,status=400,retryable=False,details=None):
        super().__init__(message)
        self.code,self.message,self.status,self.retryable,self.details=code,message,status,retryable,details
    def public(self):
        return {'code':self.code,'message':self.message,'retryable':self.retryable,**({'details':self.details} if self.details else {})}
