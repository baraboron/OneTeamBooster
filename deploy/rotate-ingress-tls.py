"""Rotate only the approved ips.co.kr ingress certificates; never print key data."""
import argparse,base64,datetime,hashlib,json,os,pathlib,ssl,subprocess,tempfile
TARGETS=[('harbor','harbor-root-ca'),('ingress-nginx','global-tls-secret'),('jenkins','jenkins-root-ca-secret'),('monitoring','monitor-root-ca-secret'),('wonix','wonix-root-ca-secret')]
EXPECTED='7F5CA06E7B9396243536046768E3B45F2807E26EB3077D1EA266083B4FE785AE'
def command(args,data=None):
    p=subprocess.run(args,input=data,capture_output=True)
    if p.returncode:raise RuntimeError('COMMAND_FAILED: '+args[0])
    return p.stdout
def secret(ns,name):return json.loads(command(['kubectl','-n',ns,'get','secret',name,'-o','json']))
def fingerprint(pem):return hashlib.sha256(command(['openssl','x509','-outform','DER'],pem)).hexdigest().upper()
def store(path,value):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as file:json.dump(value,file)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--directory',required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    directory=pathlib.Path(args.directory).resolve();directory.chmod(0o700)
    cert=(directory/'server.crt').read_bytes();key=(directory/'server.key').read_bytes();(directory/'server.key').chmod(0o600)
    if fingerprint(cert)!=EXPECTED:raise RuntimeError('UNEXPECTED_CERTIFICATE')
    command(['openssl','x509','-checkend','2592000','-noout'],cert)
    certpub=command(['openssl','x509','-pubkey','-noout'],cert)
    keypub=command(['openssl','pkey','-pubout'],key)
    if certpub!=keypub:raise RuntimeError('CERTIFICATE_KEY_MISMATCH')
    originals=[]
    for ns,name in TARGETS:
        value=secret(ns,name);old=base64.b64decode(value['data']['tls.crt'])
        subject=command(['openssl','x509','-subject','-noout'],old).decode()
        if '*.ips.co.kr' not in subject or value['type']!='kubernetes.io/tls' or value.get('immutable'):raise RuntimeError('TARGET_MISMATCH')
        originals.append((ns,name,value));print(json.dumps({'namespace':ns,'name':name,'oldFingerprint':fingerprint(old),'change':fingerprint(old)!=EXPECTED}))
    if not args.apply:return
    backup=directory/('backup-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
    for ns,name,value in originals:store(backup/(ns+'--'+name+'.json'),value)
    updated=[]
    for ns,name,value in originals:
        if fingerprint(base64.b64decode(value['data']['tls.crt']))==EXPECTED:continue
        patch=[{'op':'test','path':'/metadata/resourceVersion','value':value['metadata']['resourceVersion']},
               {'op':'replace','path':'/data/tls.crt','value':base64.b64encode(cert).decode()},
               {'op':'replace','path':'/data/tls.key','value':base64.b64encode(key).decode()}]
        fd,path=tempfile.mkstemp(dir=directory,prefix='tls-patch-',suffix='.json')
        try:
            with os.fdopen(fd,'w') as file:json.dump(patch,file)
            command(['kubectl','-n',ns,'patch','secret',name,'--type=json','--patch-file',path])
        finally:os.unlink(path)
        assert fingerprint(base64.b64decode(secret(ns,name)['data']['tls.crt']))==EXPECTED
        updated.append(ns+'/'+name)
    print(json.dumps({'updated':updated,'backupDirectory':str(backup),'fingerprint':EXPECTED}))
if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'error':str(error) if isinstance(error,RuntimeError) else type(error).__name__}));raise SystemExit(1)
