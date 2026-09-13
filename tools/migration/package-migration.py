#!/usr/bin/env python3
"""Package this project and explicitly supplied server snapshot for private Mac migration."""
import argparse, datetime, hashlib, json, os, shutil, tarfile
from pathlib import Path

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--snapshot',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    os.umask(0o077)
    source=Path(__file__).resolve().parents[2]
    templates=Path(__file__).resolve().parent
    args.output.mkdir(parents=True,exist_ok=True,mode=0o700)
    name='another-you-mac-migration-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    bundle=args.output/name; bundle.mkdir(mode=0o700)
    shutil.copytree(source,bundle/'another-you',ignore=shutil.ignore_patterns('node_modules','.DS_Store','.git'))
    private=bundle/'private'; private.mkdir(mode=0o700)
    cfg=json.loads((Path.home()/'.workbench/config.json').read_text())
    active=cfg['current']
    (private/'workbench-config.json').write_text(json.dumps({'current':active,'profiles':{active:cfg['profiles'][active]}},ensure_ascii=False,indent=2)+'\n')
    shutil.copyfile(args.snapshot,private/'server-snapshot.tgz')
    for filename in ['bootstrap-mac.sh','start-local.sh','迁移说明.md']:
        shutil.copyfile(templates/filename,bundle/filename)
    for file in bundle.rglob('*'):
        if file.is_file(): file.chmod(0o700 if file.suffix=='.sh' else 0o600)
        elif file.is_dir(): file.chmod(0o700)
    files=sorted(x for x in bundle.rglob('*') if x.is_file())
    (bundle/'SHA256SUMS').write_text(''.join(f'{digest(x)}  {x.relative_to(bundle)}\n' for x in files))
    archive=args.output/(name+'.tar.gz')
    with tarfile.open(archive,'w:gz') as tar: tar.add(bundle,arcname=name)
    archive.chmod(0o600)
    (args.output/(archive.name+'.sha256')).write_text(f'{digest(archive)}  {archive.name}\n')
    print(f'Bundle: {bundle}\nArchive: {archive}\nFiles: {len(files)}\nBytes: {archive.stat().st_size}')

if __name__=='__main__': main()
