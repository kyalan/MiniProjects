class EMailSender():
    
    outlook = None
    
    def __init__(self):
        
        import win32com.client as win32
        self.outlook = win32.Dispatch('outlook.application')
        
    def Send_EMail(self, subject, body, htmlbody=None, receivers=['alan.lo@fleetship.com'], attachments=[]):
        
        import win32com.client as win32
        from datetime import datetime as dt
        
        try:
            mail = self.outlook.CreateItem(0)
            mail.To = ';'.join(receivers)
            mail.Subject = f'[PYTHON MSG] {subject}'
            mail.Body = body
            if htmlbody is not None:
                mail.HTMLBody = htmlbody

            # To attach a file to the email:
            for attachment in attachments:
                mail.Attachments.Add(attachment)
            
            mail.Send()
            print(f'{dt.now()} EMail is sent successfully')
            return True
        except Exception as e:
            print(f'{dt.now()} Error: {str(e)}')
            return False